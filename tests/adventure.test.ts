import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { acceptQuest, claimQuest, equipReward, getAdventure } from "../lib/adventure/service";
import { adventureView, dailyOptionalQuests, optionalQuestDefinitions } from "../lib/adventure/quests";
import { achievementFor } from "../lib/adventure/achievements";

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

test("optional quests rotate, require explicit acceptance and enforce two persisted account-scoped slots", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values(["a", "b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test" })));
    const before = await getAdventure("a", database);
    assert.equal(before.optionalQuests.length, 4);
    const [first, second, third] = before.optionalQuests;
    await assert.rejects(claimQuest("a", first.id, database), /quest_not_accepted/);
    const unoffered = optionalQuestDefinitions.find(quest => !before.optionalQuests.some(offered => offered.id === quest.id))!;
    await assert.rejects(acceptQuest("a", unoffered.id, database), /invalid_quest/);
    await assert.rejects(acceptQuest("a", "first-log", database), /invalid_quest/);
    await acceptQuest("a", first.id, database); await acceptQuest("a", first.id, database);
    assert.equal((await getAdventure("a", database)).optionalSlotsRemaining, 1);
    assert.equal((await getAdventure("b", database)).optionalSlotsRemaining, 2);
    await acceptQuest("a", second.id, database);
    await assert.rejects(acceptQuest("a", third.id, database), /quest_slots_full/);
    const view = await getAdventure("a", database);
    assert.equal(view.totalXp, 0); assert.equal(view.optionalSlotsRemaining, 0);
    // Supply qualifying current-day records for every offered metric; old and other-user logs cannot contribute.
    for (const [index, method] of ["text", "search", "photo", "voice", "recipe"].entries()) await database.insert(schema.foodLogs).values({ userId: "a", mealType: ["breakfast", "lunch", "dinner"][index % 3] as "breakfast", inputMethod: method as "text", notes: "Catatan porsi", totalCalories: 1 });
    const claimed = await claimQuest("a", first.id, database);
    assert.equal(claimed.totalXp, first.xp);
    assert.equal((await claimQuest("a", first.id, database)).totalXp, first.xp);
    await assert.rejects(claimQuest("b", first.id, database), /quest_not_accepted/);
    await assert.rejects(database.insert(schema.questSelections).values({ userId: "a", day: before.day, questId: third.id, slot: 3 }));
    await assert.rejects(database.insert(schema.questSelections).values({ userId: "a", day: before.day, questId: third.id, slot: 1 }));
    // All nine definitions appear, without repeats within a day, over a complete rotation.
    const seen = new Set<string>();
    for (let day = 1; day <= 9; day++) { const offered = dailyOptionalQuests(`2026-11-${String(day).padStart(2,"0")}`); assert.equal(new Set(offered.map(q => q.id)).size,4); offered.forEach(q => seen.add(q.id)); }
    assert.equal(seen.size, 9);
    assert.notDeepEqual(dailyOptionalQuests("2026-11-01"), dailyOptionalQuests("2026-11-02"));
    const tomorrow = "2099-01-01";
    await database.insert(schema.questSelections).values({ userId: "a", day: tomorrow, questId: first.id, slot: 1 });
    assert.equal((await getAdventure("a", database)).optionalSlotsRemaining, 0);
  } finally { client.close(); }
});

test("daily login is explicit, account-scoped, idempotent and resets at midnight WIB without losing XP", async context => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values(["a", "b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test" })));
    context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-14T16:59:59Z") });
    const before = await getAdventure("a", database);
    assert.equal(before.day, "2026-11-14"); assert.equal(before.totalXp, 0);
    assert.equal(before.dailyLogin.claimed, false); assert.equal(before.dailyLogin.ready, true);
    assert.equal((await database.select().from(schema.questClaims)).length, 0, "Reading progress never grants XP");
    assert.equal((await claimQuest("a", "daily-login", database)).totalXp, 10);
    const duplicate = await claimQuest("a", "daily-login", database);
    assert.equal(duplicate.totalXp, 10); assert.equal(duplicate.dailyLogin.claimed, true);
    const other = await getAdventure("b", database);
    assert.equal(other.totalXp, 0); assert.equal(other.dailyLogin.claimed, false);
    assert.equal((await claimQuest("b", "daily-login", database)).totalXp, 10);
    assert.equal((await database.select().from(schema.questClaims).where(eq(schema.questClaims.userId, "a"))).length, 1);
    context.mock.timers.setTime(new Date("2026-11-14T17:00:00Z").getTime());
    const midnight = await getAdventure("a", database);
    assert.equal(midnight.day, "2026-11-15"); assert.equal(midnight.dailyLogin.claimed, false); assert.equal(midnight.totalXp, 10);
    assert.equal((await claimQuest("a", "daily-login", database)).totalXp, 20);
    assert.equal((await claimQuest("a", "daily-login", database)).totalXp, 20);
    context.mock.timers.setTime(new Date("2026-11-20T17:00:00Z").getTime());
    assert.equal((await getAdventure("a", database)).totalXp, 20, "Missed days do not reduce XP");
    assert.equal((await claimQuest("a", "daily-login", database)).totalXp, 30);
    assert.equal((await database.select().from(schema.foodLogs)).length, 0, "Login reward does not require food logs");
  } finally { client.close(); }
});

test("celebrations derive from actual XP changes and never replay on unchanged or duplicate claims", () => {
  assert.deepEqual(dailyOptionalQuests(""), []);
  const view = (xp: number, reward = "moon-scout") => adventureView("2026-11-14", { meals: 1, types: 1, foods: 1 }, [], xp, reward);
  assert.equal(achievementFor(view(0),view(0)),null);
  assert.equal(achievementFor(view(20),view(20)),null);
  assert.equal(achievementFor(view(0),view(20))?.kind,"xp");
  assert.deepEqual(achievementFor(view(65),view(110)), { kind:"level", level:2, xp:45, rewards:["Jubah orbit"] });
  assert.deepEqual(achievementFor(view(290),view(310)), { kind:"level", level:4, xp:20, rewards:["Pemandu aurora"] });
  assert.equal(achievementFor(view(100),view(100,"orbit-cloak"))?.kind,"equip");
});
