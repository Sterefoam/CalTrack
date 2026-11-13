import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { recipeFavorites, recipes } from "@/db/schema";
import { InputError } from "@/lib/http/json";

function validId(id: string) {
  if (!id || id.length > 128) throw new InputError("invalid_recipe_id");
}
export async function saveRecipeFavorite(userId: string, recipeId: string, database = db) {
  validId(recipeId);
  const [recipe] = await database.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe) throw new InputError("recipe_not_found", 404);
  await database.insert(recipeFavorites).values({ userId, recipeId }).onConflictDoNothing({ target: [recipeFavorites.userId, recipeFavorites.recipeId] });
  return { recipeId, saved: true as const };
}
export async function deleteRecipeFavorite(userId: string, recipeId: string, database = db) {
  validId(recipeId);
  await database.delete(recipeFavorites).where(and(eq(recipeFavorites.userId, userId), eq(recipeFavorites.recipeId, recipeId)));
}
export async function listRecipeFavorites(userId: string, query: URLSearchParams, database = db) {
  const limit = Number(query.get("limit") ?? 20);
  const cursor = query.get("cursor");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor !== null && (!cursor || cursor.length > 128))) throw new InputError("invalid_recipe_query");
  const rows = await database.select({ recipe: recipes }).from(recipeFavorites).innerJoin(recipes, eq(recipeFavorites.recipeId, recipes.id)).where(and(eq(recipeFavorites.userId, userId), cursor ? gt(recipes.id, cursor) : undefined)).orderBy(asc(recipes.id)).limit(limit + 1);
  return { recipes: rows.slice(0, limit).map(row => row.recipe), nextCursor: rows.length > limit ? rows[limit - 1].recipe.id : null };
}
