import { AnalysisError, foodAnalysisSchema, parseFoodAnalysis } from "./food-analysis";
import type { FoodItem } from "@/lib/demo/nutrition-data";

export type PhotoReference = { kind: "plate_diameter_cm" | "known_total_grams"; value: number };
export type PhotoWeightAssessment = { method: "plate_reference_estimate" | "user_total_weight"; reference: PhotoReference;
  items: { foodName: string; lowerGrams: number; upperGrams: number; note: string }[]; calibrated: false };

export function parsePhotoReference(value: unknown): PhotoReference | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    if (value.length > 200) throw new AnalysisError("invalid_photo_reference", 400);
    try { value = JSON.parse(value); } catch { throw new AnalysisError("invalid_photo_reference", 400); }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnalysisError("invalid_photo_reference", 400);
  const row = value as Record<string,unknown>;
  if (Object.keys(row).some(key => key !== "kind" && key !== "value") || typeof row.value !== "number" || !Number.isFinite(row.value)) throw new AnalysisError("invalid_photo_reference", 400);
  if (row.kind === "plate_diameter_cm" && row.value >= 10 && row.value <= 60 || row.kind === "known_total_grams" && row.value >= 0.1 && row.value <= 10000) return { kind: row.kind, value: row.value };
  throw new AnalysisError("invalid_photo_reference", 400);
}

const originalItem = foodAnalysisSchema.properties.items.items;
export const referencedPhotoSchema = { ...foodAnalysisSchema,
  properties: { ...foodAnalysisSchema.properties, reference_visible: { type: "boolean" },
    weight_ranges: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: false,
      properties: { lower_grams: { type: "number",minimum:0.1 },upper_grams:{type:"number",minimum:0.1},note:{type:"string"} },
      required:["lower_grams","upper_grams","note"] } },
    items: { ...foodAnalysisSchema.properties.items,items:originalItem },
  }, required:[...foodAnalysisSchema.required,"reference_visible","weight_ranges"],
};

export function parseReferencedPhoto(value: unknown, reference: PhotoReference) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnalysisError("invalid_ai_response");
  const row = value as Record<string,unknown>;
  if (typeof row.reference_visible !== "boolean") throw new AnalysisError("invalid_ai_response");
  if (reference.kind === "plate_diameter_cm" && !row.reference_visible) throw new AnalysisError("reference_not_visible",422);
  const result = parseFoodAnalysis(value);
  if (!Array.isArray(row.weight_ranges) || row.weight_ranges.length !== result.items.length) throw new AnalysisError("invalid_ai_response");
  const factor = reference.kind === "known_total_grams" ? reference.value/result.items.reduce((sum,item)=>sum+item.weightGrams,0) : 1;
  const items = result.items.map(item=>Object.fromEntries(Object.entries(item).map(([key,val])=>[key,key === "foodName" ? val : (val as number)*factor])) as FoodItem);
  const ranges = row.weight_ranges.map((value,index)=>{
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnalysisError("invalid_ai_response");
    const entry = value as Record<string,unknown>;
    if (typeof entry.lower_grams !== "number" || typeof entry.upper_grams !== "number" || !Number.isFinite(entry.lower_grams) || !Number.isFinite(entry.upper_grams) || entry.lower_grams <= 0 || entry.upper_grams > 10000 || entry.lower_grams > result.items[index].weightGrams || entry.upper_grams < result.items[index].weightGrams || typeof entry.note !== "string" || entry.note.length > 300) throw new AnalysisError("invalid_ai_response");
    return { foodName:items[index].foodName,lowerGrams:entry.lower_grams*factor,upperGrams:Math.min(entry.upper_grams*factor,reference.kind === "known_total_grams" ? reference.value : 10000),note:entry.note };
  });
  // Revalidate scaled nutrients and grams with the same application limits.
  const checked = parseFoodAnalysis({items:items.map((item,index)=>({food_name:item.foodName,estimated_weight_grams:item.weightGrams,calories:item.calories,
    macros:{protein_g:item.proteinG,carbs_g:item.carbsG,fat_g:item.fatG},micros:{fiber_g:item.fiberG,sugar_g:item.sugarG,sodium_mg:item.sodiumMg},confidence_score:result.confidenceScore})),confidence_score:result.confidenceScore});
  return { ...checked,photoAssessment:{method:reference.kind === "known_total_grams" ? "user_total_weight" : "plate_reference_estimate",reference,items:ranges,calibrated:false} as PhotoWeightAssessment };
}
