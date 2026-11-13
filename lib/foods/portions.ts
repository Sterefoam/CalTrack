import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { foods } from "@/db/schema";
import { InputError } from "@/lib/http/json";

// Catalogue references use current per-100g values. Manual items keep their edited nutrition.
export async function resolveCatalogPortions(input: unknown, database = db): Promise<unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const body = input as Record<string, unknown>;
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) return input;
  const items = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.foodId == null) { items.push(raw); continue; }
    if (typeof raw.foodId !== "string" || !raw.foodId || raw.foodId.length > 128) throw new InputError("invalid_food_id");
    if (typeof raw.weightGrams !== "number" || !Number.isFinite(raw.weightGrams) || raw.weightGrams < 0.1 || raw.weightGrams > 10000) throw new InputError("invalid_food_portion");
    const [food] = await database.select().from(foods).where(eq(foods.id, raw.foodId)).limit(1);
    if (!food) throw new InputError("food_not_found", 404);
    const scale = (value: number) => Math.round(value * raw.weightGrams / 100 * 1000) / 1000;
    items.push({ foodId: food.id, foodName: food.name, weightGrams: raw.weightGrams,
      calories: scale(food.caloriesPer100g), proteinG: scale(food.proteinPer100g),
      carbsG: scale(food.carbsPer100g), fatG: scale(food.fatPer100g),
      fiberG: scale(food.fiberPer100g), sugarG: scale(food.sugarPer100g), sodiumMg: scale(food.sodiumPer100g) });
  }
  return { ...body, items };
}
