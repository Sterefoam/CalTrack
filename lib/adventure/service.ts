import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adventureProfiles, foodLogItems, foodLogs, questClaims, questSelections } from "@/db/schema";
import { parseDashboardDate } from "@/lib/dashboard/get-daily-summary";
import { InputError } from "@/lib/http/json";
import { adventureView, dailyOptionalQuests, optionalQuestLimit, questMetrics, rewardDefinitions } from "./quests";

type Database = typeof db;
type QueryDatabase = Pick<Database, "select">;
// One canonical quest day prevents changing a client timezone to farm rewards.
async function readState(userId: string, database: QueryDatabase) {
  const day = parseDashboardDate(null, "Asia/Jakarta")!;
  const [logs, claims, profile, total, selections] = await Promise.all([
    database.select({ id: foodLogs.id, mealType: foodLogs.mealType, inputMethod: foodLogs.inputMethod, notes: foodLogs.notes }).from(foodLogs).where(and(eq(foodLogs.userId, userId), gte(foodLogs.loggedAt, day.start), lt(foodLogs.loggedAt, day.end))),
    database.select({ questId: questClaims.questId }).from(questClaims).where(and(eq(questClaims.userId, userId), eq(questClaims.day, day.date))),
    database.select().from(adventureProfiles).where(eq(adventureProfiles.userId, userId)).limit(1),
    database.select({ xp: sql<number>`coalesce(sum(${questClaims.xp}), 0)`.mapWith(Number) }).from(questClaims).where(eq(questClaims.userId, userId)),
    database.select({ questId: questSelections.questId }).from(questSelections).where(and(eq(questSelections.userId, userId), eq(questSelections.day, day.date)))
  ]);
  const items = logs.length ? await database.select({ name: foodLogItems.foodName }).from(foodLogItems).where(inArray(foodLogItems.foodLogId, logs.map(log => log.id))) : [];
  return adventureView(day.date, questMetrics(logs, items.map(item => item.name)), claims.map(claim => claim.questId), total[0].xp, profile[0]?.equippedReward ?? "moon-scout", selections.map(selection => selection.questId));
}
export async function getAdventure(userId: string, database = db) { return readState(userId, database); }

export async function claimQuest(userId: string, questId: unknown, database = db) {
  await database.transaction(async tx => {
    const view = await readState(userId, tx);
    const current = [...view.quests, ...view.optionalQuests].find(item => item.id === questId);
    if (!current) throw new InputError("invalid_quest");
    if (!current.accepted) throw new InputError("quest_not_accepted", 409);
    if (current.claimed) return;
    if (!current.ready) throw new InputError("quest_not_ready", 409);
    await tx.insert(questClaims).values({ userId, day: view.day, questId: current.id, xp: current.xp }).onConflictDoNothing();
  });
  return readState(userId, database);
}
export async function acceptQuest(userId: string, questId: unknown, database = db) {
  await database.transaction(async tx => {
    const day = parseDashboardDate(null, "Asia/Jakarta")!.date;
    if (!dailyOptionalQuests(day).some(quest => quest.id === questId)) throw new InputError("invalid_quest");
    const selected = await tx.select({ questId: questSelections.questId, slot: questSelections.slot }).from(questSelections).where(and(eq(questSelections.userId, userId), eq(questSelections.day, day)));
    if (selected.some(selection => selection.questId === questId)) return;
    if (selected.length >= optionalQuestLimit) throw new InputError("quest_slots_full", 409);
    const slot = [1, 2].find(value => !selected.some(selection => selection.slot === value))!;
    await tx.insert(questSelections).values({ userId, day, questId: questId as string, slot }).onConflictDoNothing();
  });
  return readState(userId, database);
}
export async function equipReward(userId: string, rewardId: unknown, database = db) {
  const reward = rewardDefinitions.find(item => item.id === rewardId);
  if (!reward) throw new InputError("invalid_reward");
  await database.transaction(async tx => {
    const [total] = await tx.select({ xp: sql<number>`coalesce(sum(${questClaims.xp}), 0)`.mapWith(Number) }).from(questClaims).where(eq(questClaims.userId, userId));
    if (total.xp < reward.xp) throw new InputError("reward_locked", 409);
    await tx.insert(adventureProfiles).values({ userId, equippedReward: reward.id }).onConflictDoUpdate({ target: adventureProfiles.userId, set: { equippedReward: reward.id } });
  });
  return readState(userId, database);
}
