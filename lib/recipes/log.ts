import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes } from "@/db/schema";
import { createFoodLog, validateFoodLogInput } from "@/lib/food-logs/create-food-log";
import { InputError } from "@/lib/http/json";

export async function logRecipe(userId: string, recipeId: string, body: unknown, database = db) {
  if (!recipeId || recipeId.length > 128 || !body || typeof body !== "object" || Array.isArray(body)) throw new InputError("invalid_recipe_log");
  const input = body as Record<string, unknown>;
  if (typeof input.portions !== "number" || !Number.isFinite(input.portions) || input.portions < 0.1 || input.portions > 20) throw new InputError("invalid_recipe_portions");
  const [recipe] = await database.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe) throw new InputError("recipe_not_found", 404);
  const portions = input.portions;
  const scale = (value: number) => Math.round(value * portions * 1000) / 1000;
  const micros: Record<string, unknown> = {};
  for (const key of ["fiberG", "sugarG", "sodiumMg"] as const) {
    // Explicit confirmation is for the total eaten, not per serving.
    if (recipe[key] === null && input[key] === undefined) throw new InputError("recipe_nutrition_confirmation_required", 422);
    micros[key] = recipe[key] === null ? input[key] : scale(recipe[key]);
  }
  const validation = validateFoodLogInput({
    mealType: input.mealType ?? recipe.mealType,
    inputMethod: "recipe",
    loggedAt: input.loggedAt,
    notes: `${recipe.source === "example" ? "Resep contoh" : "Resep"}: ${recipe.name}; ${portions} porsi. Nilai gizi merupakan estimasi.`,
    items: [{ foodName: recipe.name, weightGrams: input.weightGrams, calories: scale(recipe.calories), proteinG: scale(recipe.proteinG), carbsG: scale(recipe.carbsG), fatG: scale(recipe.fatG), ...micros }]
  });
  if ("error" in validation) throw new InputError("invalid_recipe_log");
  return createFoodLog(userId, validation.value, database);
}
