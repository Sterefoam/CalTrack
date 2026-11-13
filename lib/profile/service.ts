import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { nutritionTargets, userProfiles, users } from "@/db/schema";
import { calculateTargets, type PhysicalProfile } from "@/lib/nutrition/profile";
export async function getProfile(userId: string, database = db) {
  const [profile] = await database.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (!profile) return null;
  const [user] = await database.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const [target] = await database.select().from(nutritionTargets).where(eq(nutritionTargets.userId, userId)).orderBy(desc(nutritionTargets.effectiveFrom)).limit(1);
  return { profile: { ...profile, name: user.name }, target: target ?? null };
}
export async function saveProfile(userId: string, profile: PhysicalProfile, database = db) {
  const targets = calculateTargets(profile);
  return database.transaction(async tx => {
    const { name, ...physical } = profile;
    const [user] = await tx.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id });
    if (!user) throw new Error("profile_user_missing");
    const [previous] = await tx.select({ effectiveFrom: nutritionTargets.effectiveFrom }).from(nutritionTargets).where(eq(nutritionTargets.userId, userId)).orderBy(desc(nutritionTargets.effectiveFrom)).limit(1);
    const effectiveFrom = new Date(Math.max(Date.now(), (previous?.effectiveFrom.getTime() ?? 0) + 1));
    await tx.insert(userProfiles).values({ userId, ...physical }).onConflictDoUpdate({ target: userProfiles.userId, set: { ...physical, updatedAt: new Date() } });
    await tx.insert(nutritionTargets).values({ id: randomUUID(), userId, bmr: targets.bmr, tdee: targets.tdee, targetCalories: targets.calories, targetProteinG: targets.proteinG, targetCarbsG: targets.carbsG, targetFatG: targets.fatG, effectiveFrom });
    return { profile, targets, effectiveFrom };
  });
}

export async function deleteProfile(userId: string, database = db) {
  await database.transaction(async tx => {
    await tx.delete(nutritionTargets).where(eq(nutritionTargets.userId, userId));
    await tx.delete(userProfiles).where(eq(userProfiles.userId, userId));
  });
}
