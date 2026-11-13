import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { claimQuest, equipReward, getAdventure } from "../lib/adventure/service";

test("quests derive progress from owned current food logs and award XP only once", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values(["a", "b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test" })));
    await assert.rejects(claimQuest("a", "first-log", database), /quest_not_ready/);
    await assert.rejects(claimQuest("a", "invented", database), /invalid_quest/);
    await assert.rejects(equipReward("a", "aurora-guide", database), /reward_locked/);
    const values = { userId: "a", inputMethod: "search" as const, totalCalories: 100, totalProteinG: 5, totalCarbsG: 10, totalFatG: 5 };
    await database.insert(schema.foodLogs).values([{ ...values, id: "l1", mealType: "breakfast" }, { ...values, id: "l2", mealType: "lunch" }, { ...values, id: "old", mealType: "dinner", loggedAt: new Date("2000-01-01") }]);
    for (const [index, foodName] of ["Tahu", "Bayam", "Nasi"].entries()) await database.insert(schema.foodLogItems).values({ foodLogId: "l1", foodName, weightGrams: 100, calories: 30, proteinG: 1, carbsG: 2, fatG: 1, id: `f${index}` });
    const view = await getAdventure("a", database); assert.deepEqual(view.quests.map(quest => quest.progress), [1, 2, 3]);
    assert.equal((await getAdventure("b", database)).quests[0].progress, 0);
    await claimQuest("a", "first-log", database); await claimQuest("a", "first-log", database);
    await claimQuest("a", "meal-rhythm", database); const complete = await claimQuest("a", "food-journal", database);
    assert.equal(complete.totalXp, 100); assert.equal(complete.level, 2); assert.equal(complete.levelXp, 0);
    assert.equal((await database.select().from(schema.questClaims)).length, 3);
    const equipped = await equipReward("a", "orbit-cloak", database); assert.equal(equipped.equippedReward, "orbit-cloak");
    assert.equal((await getAdventure("b", database)).equippedReward, "moon-scout");
    await database.delete(schema.foodLogs).where(eq(schema.foodLogs.userId, "a"));
    assert.equal((await claimQuest("a", "first-log", database)).totalXp, 100);
    await assert.rejects(equipReward("b", "orbit-cloak", database), /reward_locked/);
    // A direct duplicate write is also rejected by the storage invariant.
    await assert.rejects(database.insert(schema.questClaims).values({ userId: "a", day: complete.day, questId: "first-log", xp: 20 }));
  } finally { client.close(); }
});
