import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { createFoodLog, validateFoodLogInput } from "../lib/food-logs/create-food-log";
import { deleteFoodLog, FoodLogNotFound, getFoodLog, updateFoodLog } from "../lib/food-logs/update-food-log";
import { resolveCatalogPortions } from "../lib/foods/portions";
const rice = { foodName: " Nasi ", weightGrams: 200, calories: 260, proteinG: 5, carbsG: 56, fatG: 0.6, fiberG: 0.8, sugarG: 0.2, sodiumMg: 2 };

test("catalogue portions calculate every nutrient and preserve the saved snapshot", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values({ id: "owner", email: "portion@example.test", name: "Test", passwordHash: "test" });
    await database.insert(schema.foods).values({ id: "rice", name: "Nasi katalog", servingSizeG: 100, caloriesPer100g: 130, proteinPer100g: 2.5, carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, sugarPer100g: 0.1, sodiumPer100g: 1, source: "manual" });
    const input = { mealType: "lunch", inputMethod: "search", items: [{ foodId: "rice", weightGrams: 150, calories: 1 }] };
    const result = validateFoodLogInput(await resolveCatalogPortions(input, database)); assert.ok("value" in result);
    assert.deepEqual(result.value.items[0], { foodId: "rice", foodName: "Nasi katalog", weightGrams: 150, calories: 195, proteinG: 3.75, carbsG: 42, fatG: 0.45, fiberG: 0.6, sugarG: 0.15, sodiumMg: 1.5 });
    const log = await createFoodLog("owner", result.value, database);
    assert.equal(log.totals.calories, 195);
    await database.delete(schema.foods);
    const snapshot = await getFoodLog("owner", log.id, database);
    assert.equal(snapshot.items[0].foodId, null); assert.equal(snapshot.items[0].calories, 195);
    await assert.rejects(resolveCatalogPortions(input, database), /food_not_found/);
    for (const grams of [0, -1, Infinity, 10001, "150"]) {
      await assert.rejects(resolveCatalogPortions({ ...input, items: [{ foodId: "rice", weightGrams: grams }] }, database), /invalid_food_portion/);
    }
  } finally { client.close(); }
});
test("food log stores final edited items atomically and computes its own totals", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values({ id: "owner", email: "logs@example.test", name: "Test", passwordHash: "test" });
    const validation = validateFoodLogInput({ userId: "other", mealType: "lunch", inputMethod: "photo", totalCalories: 1, rawAiResponse: { arbitrary: "untrusted" }, items: [rice, { ...rice, foodName: "Ayam", calories: 165 }], confidenceScore: 0.88 });
    assert.ok("value" in validation);
    const saved = await createFoodLog("owner", validation.value, database);
    assert.equal(saved.totals.calories, 425);
    assert.equal(saved.items[0].foodName, "Nasi");
    assert.equal((await database.select().from(schema.foodLogItems)).length, 2);
    assert.equal((await database.select().from(schema.foodLogs))[0].userId, "owner");
    assert.equal((await database.select().from(schema.foodLogs))[0].rawAiResponse, null);
    await assert.rejects(createFoodLog("owner", { ...validation.value, items: [{ ...rice, calories: -1 }] }, database));
    assert.equal((await database.select().from(schema.foodLogs)).length, 1);
    await assert.rejects(updateFoodLog("other", saved.id, validation.value, database), FoodLogNotFound);
    await assert.rejects(deleteFoodLog("other", saved.id, database), FoodLogNotFound);
    await assert.rejects(getFoodLog("other", saved.id, database), FoodLogNotFound);
    await updateFoodLog("owner", saved.id, { ...validation.value, items: [{ ...rice, calories: 123 }] }, database);
    assert.equal((await getFoodLog("owner", saved.id, database)).totalCalories, 123);
    assert.equal((await database.select().from(schema.foodLogItems)).length, 1);
    await assert.rejects(updateFoodLog("owner", saved.id, { ...validation.value, items: [{ ...rice, calories: -1 }] }, database));
    assert.equal((await getFoodLog("owner", saved.id, database)).totalCalories, 123);
    await deleteFoodLog("owner", saved.id, database);
    assert.equal((await database.select().from(schema.foodLogs)).length, 0);
    assert.equal((await database.select().from(schema.foodLogItems)).length, 0);
    await assert.rejects(createFoodLog("absent", validation.value, database));
    assert.equal((await database.select().from(schema.foodLogs)).length, 0);
  } finally { client.close(); }
});
test("food log validates all input sources, units, non-finite values and empty meals", () => {
  for (const inputMethod of ["photo", "voice", "text", "barcode", "search", "chat", "recipe"]) assert.ok("value" in validateFoodLogInput({ mealType: "snack", inputMethod, items: [rice] }));
  for (const changes of [{ items: [] }, { items: [{ ...rice, sodiumMg: NaN }] }, { items: [{ ...rice, weightGrams: 0 }] }, { mealType: "invalid" }, { confidenceScore: 2 }, { imageUrl: "javascript:invalid" }]) assert.ok("error" in validateFoodLogInput({ mealType: "lunch", inputMethod: "photo", items: [rice], ...changes }));
});
