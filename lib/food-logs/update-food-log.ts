import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { foodLogItems, foodLogs } from "@/db/schema";
import type { CreateFoodLogInput } from "./create-food-log";
export class FoodLogNotFound extends Error {}
export async function getFoodLog(userId: string, id: string, database = db) {
  const [log] = await database.select().from(foodLogs).where(and(eq(foodLogs.id, id), eq(foodLogs.userId, userId))).limit(1);
  if (!log) throw new FoodLogNotFound();
  const items = await database.select().from(foodLogItems).where(eq(foodLogItems.foodLogId, id)).orderBy(foodLogItems.id);
  return { ...log, rawAiResponse: undefined, items };
}
export async function updateFoodLog(userId: string, id: string, input: CreateFoodLogInput, database = db) {
  return database.transaction(async tx => {
    const total = input.items.reduce((sum, item) => ({ totalCalories: sum.totalCalories + item.calories, totalProteinG: sum.totalProteinG + item.proteinG, totalCarbsG: sum.totalCarbsG + item.carbsG, totalFatG: sum.totalFatG + item.fatG }), { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 });
    const [updated] = await tx.update(foodLogs).set({ ...total, mealType: input.mealType, inputMethod: input.inputMethod, imageUrl: input.imageUrl, confidenceScore: input.confidenceScore, notes: input.notes, loggedAt: input.loggedAt }).where(and(eq(foodLogs.id, id), eq(foodLogs.userId, userId))).returning({ id: foodLogs.id });
    if (!updated) throw new FoodLogNotFound();
    await tx.delete(foodLogItems).where(eq(foodLogItems.foodLogId, id));
    await tx.insert(foodLogItems).values(input.items.map(item => ({ ...item, id: randomUUID(), foodLogId: id })));
    return { id, ...total, items: input.items, loggedAt: input.loggedAt };
  });
}
export async function deleteFoodLog(userId: string, id: string, database = db) {
  const deleted = await database.delete(foodLogs).where(and(eq(foodLogs.id, id), eq(foodLogs.userId, userId))).returning({ id: foodLogs.id });
  if (!deleted.length) throw new FoodLogNotFound();
}
