import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes } from "@/db/schema";
import { getDailySummary, parseDashboardDate } from "@/lib/dashboard/get-daily-summary";
import { InputError } from "@/lib/http/json";

export async function listRecipes(userId: string, query: URLSearchParams, database = db) {
  const day = parseDashboardDate(null, query.get("timeZone") ?? "Asia/Jakarta");
  if (!day) throw new InputError("invalid_time_zone");
  const limit = Number(query.get("limit") ?? 20);
  const cursor = query.get("cursor");
  const search = query.get("q")?.trim().toLowerCase() ?? "";
  const mealType = query.get("mealType");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor !== null && (!cursor || cursor.length > 128)) || (search && (search.length < 2 || search.length > 120))) throw new InputError("invalid_recipe_query");
  if (mealType !== null && !["breakfast", "lunch", "dinner", "snack"].includes(mealType)) throw new InputError("invalid_meal_type");
  const daily = await getDailySummary(userId, day, database);
  const hasTarget = daily.calories.target > 0;
  const remainingCalories = daily.calories.remaining;
  if (!hasTarget || remainingCalories <= 0) return { recipes: [], remainingCalories, hasTarget, nextCursor: null };
  const rows = await database.select().from(recipes).where(and(
    lte(recipes.calories, remainingCalories),
    cursor ? gt(recipes.id, cursor) : undefined,
    mealType ? eq(recipes.mealType, mealType as typeof recipes.$inferSelect["mealType"]) : undefined,
    search ? sql`instr(lower(${recipes.name}), ${search}) > 0` : undefined
  )).orderBy(asc(recipes.id)).limit(limit + 1);
  return { recipes: rows.slice(0, limit), remainingCalories, hasTarget, nextCursor: rows.length > limit ? rows[limit - 1].id : null };
}
