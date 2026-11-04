import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { exerciseLogs, foodLogItems, foodLogs, nutritionTargets, users, waterLogs } from "@/db/schema";
import { aggregateMacros } from "@/lib/nutrition/aggregate-macros";
import { calculateRemainingCalories } from "@/lib/nutrition/calorie-balance";

const MEAL_LABELS = {
  breakfast: "Sarapan",
  lunch: "Makan siang",
  dinner: "Makan malam",
  snack: "Camilan"
} as const;

export class UserNotFoundError extends Error {
  constructor() {
    super("Pengguna tidak ditemukan.");
    this.name = "UserNotFoundError";
  }
}

export function parseDashboardDate(value: string | null, timeZone = "Asia/Jakarta"): { date: string; timeZone: string; start: Date; end: Date } | null {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return null;
  }
  const todayParts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const date = value ?? `${todayParts.year}-${todayParts.month.padStart(2, "0")}-${todayParts.day.padStart(2, "0")}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  const nominalStart = Date.UTC(year, month - 1, dayOfMonth);
  const parsedDate = new Date(nominalStart);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
  const nextDate = new Date(nominalStart + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { date, timeZone, start: localMidnightToUtc(date, timeZone), end: localMidnightToUtc(nextDate, timeZone) };
}

function localMidnightToUtc(date: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const nominalUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const offsetAt = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    return localAsUtc - instant;
  };
  const firstGuess = nominalUtc - offsetAt(nominalUtc);
  return new Date(nominalUtc - offsetAt(firstGuess));
}

export async function getDailySummary(userId: string, day: { date: string; timeZone: string; start: Date; end: Date }, database = db) {
  const [user] = await database.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new UserNotFoundError();

  const [target] = await database
    .select()
    .from(nutritionTargets)
    .where(and(eq(nutritionTargets.userId, userId), lt(nutritionTargets.effectiveFrom, day.end)))
    .orderBy(desc(nutritionTargets.effectiveFrom))
    .limit(1);

  const [foodEntries, waterEntries, exerciseEntries] = await Promise.all([
    database.select().from(foodLogs).where(and(eq(foodLogs.userId, userId), gte(foodLogs.loggedAt, day.start), lt(foodLogs.loggedAt, day.end))).orderBy(asc(foodLogs.loggedAt)),
    database.select().from(waterLogs).where(and(eq(waterLogs.userId, userId), gte(waterLogs.loggedAt, day.start), lt(waterLogs.loggedAt, day.end))),
    database.select().from(exerciseLogs).where(and(eq(exerciseLogs.userId, userId), gte(exerciseLogs.loggedAt, day.start), lt(exerciseLogs.loggedAt, day.end)))
  ]);

  const foodItems = foodEntries.length
    ? await database.select().from(foodLogItems).where(inArray(foodLogItems.foodLogId, foodEntries.map((entry) => entry.id)))
    : [];
  const itemsByLogId = new Map<string, typeof foodItems>();
  for (const item of foodItems) {
    const items = itemsByLogId.get(item.foodLogId) ?? [];
    items.push(item);
    itemsByLogId.set(item.foodLogId, items);
  }

  const mealsByType = new Map<keyof typeof MEAL_LABELS, { loggedAt: Date; calories: number; items: Array<{ name: string; weightGrams: number; calories: number; proteinG: number; carbsG: number; fatG: number }> }>();
  for (const entry of foodEntries) {
    const current = mealsByType.get(entry.mealType) ?? { loggedAt: entry.loggedAt, calories: 0, items: [] };
    current.loggedAt = current.loggedAt < entry.loggedAt ? current.loggedAt : entry.loggedAt;
    current.calories += entry.totalCalories;
    const items = itemsByLogId.get(entry.id) ?? [];
    if (items.length) {
      current.items.push(...items.map((item) => ({
        name: item.foodName,
        weightGrams: item.weightGrams,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG
      })));
    } else {
      current.items.push({
        name: entry.notes?.trim() || "Catatan makanan",
        weightGrams: 0,
        calories: entry.totalCalories,
        proteinG: entry.totalProteinG,
        carbsG: entry.totalCarbsG,
        fatG: entry.totalFatG
      });
    }
    mealsByType.set(entry.mealType, current);
  }

  const consumedCalories = foodEntries.reduce((sum, entry) => sum + entry.totalCalories, 0);
  const exerciseCalories = exerciseEntries.reduce((sum, entry) => sum + entry.caloriesBurned, 0);
  const targetCalories = target?.targetCalories ?? 0;
  const waterAmountMl = waterEntries.reduce((sum, entry) => sum + entry.amountMl, 0);
  const waterTargetMl = 2500;
  const mealTypes = Object.keys(MEAL_LABELS) as Array<keyof typeof MEAL_LABELS>;
  const macros = aggregateMacros(foodEntries.map((entry) => ({
    proteinG: entry.totalProteinG,
    carbsG: entry.totalCarbsG,
    fatG: entry.totalFatG
  })), {
    proteinG: target?.targetProteinG ?? 0,
    carbsG: target?.targetCarbsG ?? 0,
    fatG: target?.targetFatG ?? 0
  });

  return {
    date: day.date,
    timeZone: day.timeZone,
    calories: {
      target: targetCalories,
      consumed: consumedCalories,
      burned: exerciseCalories,
      remaining: calculateRemainingCalories({ targetCalories, consumedCalories, exerciseCalories })
    },
    macros,
    water: { amountMl: waterAmountMl, targetMl: waterTargetMl, progressPercent: Math.min(100, Math.round((waterAmountMl / waterTargetMl) * 100)) },
    exercise: {
      caloriesBurned: exerciseCalories,
      durationMinutes: exerciseEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
      entries: exerciseEntries.map((entry) => ({ activity: entry.activityName, durationMinutes: entry.durationMinutes, caloriesBurned: entry.caloriesBurned, loggedAt: entry.loggedAt }))
    },
    meals: mealTypes.flatMap((type) => {
      const session = mealsByType.get(type);
      return session ? [{ type, label: MEAL_LABELS[type], loggedAt: session.loggedAt, calories: session.calories, items: session.items }] : [];
    })
  };
}
