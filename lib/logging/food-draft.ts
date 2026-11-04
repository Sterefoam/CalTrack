import type { FoodItem, MealType } from "@/lib/demo/nutrition-data";

export type InputMethod = "photo" | "voice" | "text" | "barcode" | "search";
export type FoodDraft = { id: string; inputMethod: InputMethod; mealType: MealType; confidenceScore: number | null; items: FoodItem[]; notes: string; origin?: "favorite" | "manual" };

export function createFoodDraft(inputMethod: InputMethod, items: FoodItem[], confidenceScore: number | null = null): FoodDraft {
  return { id: crypto.randomUUID(), inputMethod, mealType: "lunch", confidenceScore, items: structuredClone(items), notes: "" };
}

export const nutritionFields = [
  { key: "calories", label: "Kalori", unit: "kkal", max: 20000 },
  { key: "proteinG", label: "Protein", unit: "g", max: 2000 },
  { key: "carbsG", label: "Karbohidrat", unit: "g", max: 3000 },
  { key: "fatG", label: "Lemak", unit: "g", max: 2000 },
  { key: "fiberG", label: "Serat", unit: "g", max: 1000 },
  { key: "sugarG", label: "Gula", unit: "g", max: 2000 },
  { key: "sodiumMg", label: "Natrium", unit: "mg", max: 100000 },
] as const;
