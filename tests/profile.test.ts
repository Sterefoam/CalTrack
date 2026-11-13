import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { calculateTargets, validateProfile, type PhysicalProfile } from "../lib/nutrition/profile";
import { deleteProfile, getProfile, saveProfile } from "../lib/profile/service";
import { readJson, InputError } from "../lib/http/json";
const profile: PhysicalProfile = { name: " Test ", age: 28, gender: "male", weightKg: 75, heightCm: 175, activityLevel: "light", goal: "maintenance" };
test("BMR/TDEE matches manual calculation and rejects invalid physical inputs", () => {
  assert.equal(calculateTargets(profile).bmr, 1708.75);
  assert.equal(calculateTargets(profile).tdee, 2349.53125);
  assert.equal(calculateTargets(profile).calories, 2350);
  assert.equal(calculateTargets({ ...profile, gender: "female" }).bmr, 1542.75);
  assert.equal(calculateTargets({ ...profile, goal: "weight_loss" }).calories, 1997);
  assert.equal(calculateTargets({ ...profile, goal: "weight_gain" }).calories, 2584);
  assert.equal(validateProfile(profile)?.name, "Test");
  for (const [activityLevel, factor] of Object.entries({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 })) {
    const target = calculateTargets({ ...profile, activityLevel: activityLevel as PhysicalProfile["activityLevel"] });
    assert.equal(target.tdee, 1708.75 * factor);
    assert.equal(target.calories, Math.round(target.tdee));
    assert.ok(Math.abs(target.proteinG * 4 + target.carbsG * 4 + target.fatG * 9 - target.calories) <= 2);
  }
  for (const invalid of [{ age: 17 }, { age: 25.5 }, { weightKg: Infinity }, { heightCm: 0 }, { activityLevel: "toString" }, { goal: "__proto__" }, { gender: "other" }]) assert.equal(validateProfile({ ...profile, ...invalid }), null);
});
test("profile updates and target history commit together and remain scoped to the user", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values([{ id: "a", email: "a@example.test", name: "A", passwordHash: "test" }, { id: "b", email: "b@example.test", name: "B", passwordHash: "test" }]);
    assert.equal(await getProfile("a", database), null);
    const first = await saveProfile("a", profile, database);
    const second = await saveProfile("a", { ...profile, goal: "weight_loss" }, database);
    assert.ok(second.effectiveFrom > first.effectiveFrom);
    assert.equal((await getProfile("a", database))?.target?.targetCalories, 1997);
    assert.equal(await getProfile("b", database), null);
    assert.equal((await database.select().from(schema.userProfiles)).length, 1);
    assert.equal((await database.select().from(schema.nutritionTargets)).length, 2);
    await assert.rejects(saveProfile("missing", profile, database));
    assert.equal((await database.select().from(schema.nutritionTargets)).length, 2);
    await saveProfile("b", { ...profile, name: "B" }, database);
    await database.insert(schema.foodLogs).values({ id: "keep-log", userId: "a", mealType: "lunch", inputMethod: "search", loggedAt: new Date() });
    await deleteProfile("a", database);
    await deleteProfile("a", database);
    assert.equal(await getProfile("a", database), null);
    assert.ok(await getProfile("b", database));
    assert.equal((await database.select().from(schema.nutritionTargets)).length, 1);
    assert.equal((await database.select().from(schema.users)).length, 2);
    assert.equal((await database.select().from(schema.foodLogs)).length, 1);
  } finally { client.close(); }
});
test("JSON body limit applies even without a content-length header", async () => {
  const request = new Request("http://localhost/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "x".repeat(100) }) });
  await assert.rejects(readJson(request, 20), (error: unknown) => error instanceof InputError && error.status === 413);
});
