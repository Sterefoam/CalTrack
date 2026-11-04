import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { getDailySummary, parseDashboardDate } from "../lib/dashboard/get-daily-summary";
import { createFoodLog, validateFoodLogInput } from "../lib/food-logs/create-food-log";
import { deleteFoodLog, updateFoodLog } from "../lib/food-logs/update-food-log";
test("daily balance aggregates persisted logs, exercise, water and historical targets", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values(["a","b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test" })));
    await database.insert(schema.nutritionTargets).values([
      { userId: "a", bmr: 1500, tdee: 2000, targetCalories: 2000, targetProteinG: 100, targetCarbsG: 250, targetFatG: 60, effectiveFrom: new Date("2026-11-01T00:00:00Z") },
      { userId: "a", bmr: 1500, tdee: 2200, targetCalories: 2200, targetProteinG: 110, targetCarbsG: 270, targetFatG: 65, effectiveFrom: new Date("2026-11-04T00:00:00Z") }
    ]);
    const input = validateFoodLogInput({ mealType: "lunch", inputMethod: "search", loggedAt: "2026-11-03T05:00:00Z", items: [{ foodName: "Nasi", weightGrams: 200, calories: 260, proteinG: 5, carbsG: 56, fatG: 0.6, fiberG: 0.8, sugarG: 0.2, sodiumMg: 2 }] });
    assert.ok("value" in input); const saved = await createFoodLog("a", input.value, database); await createFoodLog("b", input.value, database);
    await database.insert(schema.waterLogs).values([{ userId: "a", amountMl: 3000, loggedAt: new Date("2026-11-03T05:00:00Z") }, { userId: "b", amountMl: 500, loggedAt: new Date("2026-11-03T05:00:00Z") }]);
    await database.insert(schema.exerciseLogs).values({ userId: "a", activityName: "Jalan", durationMinutes: 30, caloriesBurned: 100, loggedAt: new Date("2026-11-03T05:00:00Z") });
    const day = parseDashboardDate("2026-11-03")!;
    const summary = await getDailySummary("a", day, database);
    assert.equal(summary.calories.remaining, 1840); assert.equal(summary.calories.target, 2000);
    assert.equal(summary.water.amountMl, 3000); assert.equal(summary.water.progressPercent, 100);
    assert.equal(summary.meals[0].items[0].calories, 260);
    await updateFoodLog("a", saved.id, { ...input.value, items: [{ ...input.value.items[0], calories: 400 }] }, database);
    assert.equal((await getDailySummary("a", day, database)).calories.remaining, 1700);
    await deleteFoodLog("a", saved.id, database);
    assert.equal((await getDailySummary("a", day, database)).calories.remaining, 2100);
    assert.equal((await getDailySummary("b", day, database)).calories.consumed, 260);
  } finally { client.close(); }
});
