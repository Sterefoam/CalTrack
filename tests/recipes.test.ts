import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { listRecipes } from "../lib/recipes/service";
import { saveRecipeFavorite, deleteRecipeFavorite, listRecipeFavorites } from "../lib/recipes/favorites";
import { logRecipe } from "../lib/recipes/log";
import { getDailySummary, parseDashboardDate } from "../lib/dashboard/get-daily-summary";
import { deleteFoodLog } from "../lib/food-logs/update-food-log";

test("recipe migrations preserve unknown nutrition, ordered content and ownership of children", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await client.execute("PRAGMA foreign_keys = ON");
    const recipe = { id: "test", name: "Sup uji", description: "Resep pengujian", mealType: "dinner" as const, minutes: 20, calories: 200, proteinG: 10, carbsG: 25, fatG: 7, allergens: "Kedelai", source: "example" as const };
    await database.insert(schema.recipes).values(recipe);
    const [stored] = await database.select().from(schema.recipes);
    assert.equal(stored.fiberG, null);
    assert.equal(stored.sodiumMg, null);
    assert.equal(stored.servingWeightG, null);
    await assert.rejects(database.insert(schema.recipes).values({ ...recipe, id: "bad", sodiumMg: -1 }));
    await assert.rejects(database.insert(schema.recipes).values({ ...recipe, id: "bad", calories: -1 }));
    await database.insert(schema.recipeIngredients).values({ recipeId: "test", position: 0, label: "100 g tahu" });
    await database.insert(schema.recipeSteps).values({ recipeId: "test", position: 0, instruction: "Rebus sampai matang." });
    await assert.rejects(database.insert(schema.recipeIngredients).values({ recipeId: "test", position: 0, label: "Duplikat urutan" }));
    await assert.rejects(database.insert(schema.recipeSteps).values({ recipeId: "missing", position: 0, instruction: "Tidak valid" }));
    await database.delete(schema.recipes);
    assert.deepEqual(await database.select().from(schema.recipeIngredients), []);
    assert.deepEqual(await database.select().from(schema.recipeSteps), []);
    assert.deepEqual((await client.execute("PRAGMA foreign_key_check")).rows, []);
  } finally { client.close(); }
});

test("recipe logging scales server nutrition and requires explicit unknown micros before writing", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values({ id: "a", email: "a@example.test", name: "A", passwordHash: "test-only" });
    const base = { name: "Sup", description: "Uji", mealType: "dinner" as const, minutes: 10, calories: 200, proteinG: 10, carbsG: 20, fatG: 5, allergens: "Kedelai", source: "example" as const };
    await database.insert(schema.recipes).values([{ ...base, id: "partial" }, { ...base, id: "full", fiberG: 2, sugarG: 3, sodiumMg: 100 }]);
    const input = { portions: 1.5, weightGrams: 350, calories: 1 };
    await assert.rejects(logRecipe("a", "partial", input, database), /recipe_nutrition_confirmation_required/);
    assert.equal((await database.select().from(schema.foodLogs)).length, 0);
    const saved = await logRecipe("a", "partial", { ...input, fiberG: 4, sugarG: 5, sodiumMg: 200 }, database);
    assert.equal(saved.totals.calories, 300);
    assert.equal(saved.items[0].proteinG, 15);
    assert.equal(saved.items[0].sodiumMg, 200);
    const full = await logRecipe("a", "full", { ...input, sodiumMg: 999 }, database);
    assert.equal(full.items[0].fiberG, 3);
    assert.equal(full.items[0].sodiumMg, 150);
    for (const changes of [{ portions: 0 }, { weightGrams: 0 }, { portions: Infinity }]) await assert.rejects(logRecipe("a", "full", { ...input, ...changes }, database));
    await assert.rejects(logRecipe("a", "missing", input, database), /recipe_not_found/);
    assert.equal((await database.select().from(schema.foodLogs)).length, 2);
    assert.equal((await database.select().from(schema.foodLogs))[0].inputMethod, "recipe");
    const day = parseDashboardDate(null)!;
    const daily = await getDailySummary("a", day, database);
    assert.equal(daily.calories.consumed, 600);
    assert.equal(daily.macros.proteinG.consumed, 30);
    assert.equal(daily.macros.carbsG.consumed, 60);
    assert.equal(daily.macros.fatG.consumed, 15);
    await deleteFoodLog("a", saved.id, database);
    assert.equal((await getDailySummary("a", day, database)).macros.proteinG.consumed, 15);
  } finally { client.close(); }
});

test("recipe favorite operations are idempotent, paginated and account scoped", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values(["a", "b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test-only" })));
    const base = { name: "Sup", description: "Uji", mealType: "dinner" as const, minutes: 10, calories: 200, proteinG: 10, carbsG: 20, fatG: 5, allergens: "Kedelai", source: "example" as const };
    await database.insert(schema.recipes).values([{ ...base, id: "one" }, { ...base, id: "two" }]);
    await saveRecipeFavorite("a", "one", database);
    await saveRecipeFavorite("a", "one", database);
    await saveRecipeFavorite("a", "two", database);
    await deleteRecipeFavorite("b", "one", database);
    assert.deepEqual((await listRecipeFavorites("b", new URLSearchParams(), database)).recipes, []);
    const first = await listRecipeFavorites("a", new URLSearchParams({ limit: "1" }), database);
    assert.equal(first.recipes[0].id, "one");
    assert.equal(first.nextCursor, "one");
    const second = await listRecipeFavorites("a", new URLSearchParams({ cursor: first.nextCursor! }), database);
    assert.deepEqual(second.recipes.map(r => r.id), ["two"]);
    assert.equal(second.nextCursor, null);
    await deleteRecipeFavorite("a", "one", database);
    await deleteRecipeFavorite("a", "one", database);
    assert.equal((await listRecipeFavorites("a", new URLSearchParams(), database)).recipes.length, 1);
    await assert.rejects(saveRecipeFavorite("a", "missing", database), /recipe_not_found/);
    await assert.rejects(listRecipeFavorites("a", new URLSearchParams({ limit: "0" }), database));
  } finally { client.close(); }
});

test("recipe suggestions use the account balance, page deterministically and retain unknown micros", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values(["a", "b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test-only" })));
    await database.insert(schema.nutritionTargets).values({ userId: "a", bmr: 1500, tdee: 2000, targetCalories: 500, targetProteinG: 100, targetCarbsG: 200, targetFatG: 50 });
    const base = { name: "Sup", description: "Uji", mealType: "dinner" as const, minutes: 10, proteinG: 10, carbsG: 20, fatG: 5, allergens: "Kedelai", source: "example" as const };
    await database.insert(schema.recipes).values([{ ...base, id: "a", calories: 200 }, { ...base, id: "b", calories: 400 }, { ...base, id: "c", calories: 600 }]);
    const page = await listRecipes("a", new URLSearchParams({ limit: "1", remainingCalories: "9999" }), database);
    assert.equal(page.remainingCalories, 500);
    assert.equal(page.recipes[0].id, "a");
    assert.equal(page.recipes[0].fiberG, null);
    assert.equal(page.nextCursor, "a");
    const next = await listRecipes("a", new URLSearchParams({ cursor: page.nextCursor! }), database);
    assert.deepEqual(next.recipes.map(r => r.id), ["b"]);
    assert.equal(next.nextCursor, null);
    assert.equal((await listRecipes("b", new URLSearchParams(), database)).hasTarget, false);
    await database.insert(schema.foodLogs).values({ userId: "a", mealType: "lunch", inputMethod: "text", totalCalories: 550 });
    const exceeded = await listRecipes("a", new URLSearchParams(), database);
    assert.equal(exceeded.remainingCalories, -50);
    assert.deepEqual(exceeded.recipes, []);
    for (const query of ["limit=51", "timeZone=invalid", "mealType=invalid", "q=%25"]) await assert.rejects(listRecipes("a", new URLSearchParams(query), database));
  } finally { client.close(); }
});

test("recipe favorites are unique per account and cascade without deleting the shared recipe", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await client.execute("PRAGMA foreign_keys = ON");
    await database.insert(schema.users).values(["a", "b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test-only" })));
    await database.insert(schema.recipes).values({ id: "soup", name: "Sup", description: "Uji", mealType: "dinner", minutes: 10, calories: 100, proteinG: 5, carbsG: 10, fatG: 3, allergens: "Kedelai", source: "example" });
    await database.insert(schema.recipeFavorites).values([{ userId: "a", recipeId: "soup" }, { userId: "b", recipeId: "soup" }]);
    await assert.rejects(database.insert(schema.recipeFavorites).values({ userId: "a", recipeId: "soup" }));
    await assert.rejects(database.insert(schema.recipeFavorites).values({ userId: "missing", recipeId: "soup" }));
    await client.execute("DELETE FROM users WHERE id='a'");
    assert.equal((await database.select().from(schema.recipeFavorites)).length, 1);
    assert.equal((await database.select().from(schema.recipes)).length, 1);
    await database.delete(schema.recipes);
    assert.equal((await database.select().from(schema.recipeFavorites)).length, 0);
  } finally { client.close(); }
});
