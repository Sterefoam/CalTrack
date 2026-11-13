import type { FoodItem } from "@/lib/demo/nutrition-data";
export type CatalogEntry = { id: string; name: string; brand: string | null; source: string; servingSizeG: number; caloriesPer100g: number | null; proteinPer100g: number | null; carbsPer100g: number | null; fatPer100g: number | null; fiberPer100g: number | null; sugarPer100g: number | null; sodiumPer100g: number | null };
export function catalogPortion(food: CatalogEntry, grams: number): FoodItem | null {
  const fields = { calories: food.caloriesPer100g, proteinG: food.proteinPer100g, carbsG: food.carbsPer100g, fatG: food.fatPer100g, fiberG: food.fiberPer100g, sugarG: food.sugarPer100g, sodiumMg: food.sodiumPer100g };
  if (!Number.isFinite(grams) || grams < 1 || grams > 10000 || Object.values(fields).some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0)) return null;
  return { foodName: food.name, weightGrams: grams, ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, Math.round(value! * grams / 100 * 10) / 10])) } as FoodItem;
}
