import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { createFoodLog, validateFoodLogInput } from "../lib/food-logs/create-food-log";
import { deleteFoodLog, FoodLogNotFound, getFoodLog, updateFoodLog } from "../lib/food-logs/update-food-log";
const rice = { foodName: " Nasi ", weightGrams: 200, calories: 260, proteinG: 5, carbsG: 56, fatG: 0.6, fiberG: 0.8, sugarG: 0.2, sodiumMg: 2 };
test("food log stores final edited items atomically and computes its own totals", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values({ id: "owner", email: "logs@example.test", name: "Test", passwordHash: "test" });
    const validation = validateFoodLogInput({ mealType: "lunch", inputMethod: "photo", totalCalories: 1, items: [rice, { ...rice, foodName: "Ayam", calories: 165 }], confidenceScore: 0.88 });
    assert.ok("value" in validation);
    const saved = await createFoodLog("owner", validation.value, database);
    assert.equal(saved.totals.calories, 425);
    assert.equal(saved.items[0].foodName, "Nasi");
    assert.equal((await database.select().from(schema.foodLogItems)).length, 2);
    assert.equal((await database.select().from(schema.foodLogs))[0].userId, "owner");
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
