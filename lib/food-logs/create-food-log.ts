import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { foodLogItems, foodLogs } from "@/db/schema";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const INPUT_METHODS = ["photo", "voice", "text", "barcode", "search", "chat", "recipe"] as const;

type MealType = (typeof MEAL_TYPES)[number];
type InputMethod = (typeof INPUT_METHODS)[number];

type FoodItemInput = {
  foodName: string;
  weightGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type CreateFoodLogInput = {
  mealType: MealType;
  inputMethod: InputMethod;
  imageUrl: string | null;
  confidenceScore: number | null;
  notes: string | null;
  loggedAt: Date;
  items: FoodItemInput[];
};

export type ValidationResult = { value: CreateFoodLogInput } | { error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function validateFoodLogInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return { error: "Body harus berupa objek JSON." };
  if (typeof input.mealType !== "string" || !MEAL_TYPES.includes(input.mealType as MealType)) return { error: "mealType tidak valid." };
  if (typeof input.inputMethod !== "string" || !INPUT_METHODS.includes(input.inputMethod as InputMethod)) return { error: "inputMethod tidak valid." };
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) return { error: "items harus berisi 1 sampai 20 makanan." };

  const items: FoodItemInput[] = [];
  for (const [index, rawItem] of input.items.entries()) {
    if (!isRecord(rawItem)) return { error: `Item ke-${index + 1} tidak valid.` };
    const foodName = typeof rawItem.foodName === "string" ? rawItem.foodName.trim() : "";
    if (foodName.length < 1 || foodName.length > 120) return { error: `Nama makanan ke-${index + 1} harus 1–120 karakter.` };
    if (!finiteNumber(rawItem.weightGrams, 0.1, 10000)) return { error: `weightGrams item ke-${index + 1} harus antara 0,1 dan 10.000.` };
    const limits: Array<[keyof FoodItemInput, number]> = [
      ["calories", 20000], ["proteinG", 2000], ["carbsG", 3000], ["fatG", 2000],
      ["fiberG", 1000], ["sugarG", 2000], ["sodiumMg", 100000]
    ];
    for (const [field, max] of limits) {
      if (!finiteNumber(rawItem[field], 0, max)) return { error: `${field} item ke-${index + 1} harus angka antara 0 dan ${max}.` };
    }
    items.push({
      foodName,
      weightGrams: rawItem.weightGrams,
      calories: rawItem.calories as number,
      proteinG: rawItem.proteinG as number,
      carbsG: rawItem.carbsG as number,
      fatG: rawItem.fatG as number,
      fiberG: rawItem.fiberG as number,
      sugarG: rawItem.sugarG as number,
      sodiumMg: rawItem.sodiumMg as number
    });
  }

  let imageUrl: string | null = null;
  if (input.imageUrl !== undefined && input.imageUrl !== null) {
    if (typeof input.imageUrl !== "string" || input.imageUrl.length > 2048) return { error: "imageUrl tidak valid." };
    try {
      const url = new URL(input.imageUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "imageUrl harus menggunakan HTTP atau HTTPS." };
      imageUrl = url.toString();
    } catch {
      return { error: "imageUrl harus berupa URL yang valid." };
    }
  }

  let confidenceScore: number | null = null;
  if (input.confidenceScore !== undefined && input.confidenceScore !== null) {
    if (!finiteNumber(input.confidenceScore, 0, 1)) return { error: "confidenceScore harus antara 0 dan 1." };
    confidenceScore = input.confidenceScore;
  }

  let notes: string | null = null;
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== "string" || input.notes.length > 500) return { error: "notes maksimal 500 karakter." };
    notes = input.notes.trim() || null;
  }

  let loggedAt = new Date();
  if (input.loggedAt !== undefined) {
    if (typeof input.loggedAt !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(input.loggedAt)) return { error: "loggedAt harus berupa waktu ISO dengan zona waktu." };
    loggedAt = new Date(input.loggedAt);
    if (Number.isNaN(loggedAt.getTime())) return { error: "loggedAt tidak valid." };
  }

  return {
    value: {
      mealType: input.mealType as MealType,
      inputMethod: input.inputMethod as InputMethod,
      imageUrl,
      confidenceScore,
      notes,
      loggedAt,
      items
    }
  };
}

export async function createFoodLog(userId: string, input: CreateFoodLogInput, database = db) {
  const totals = input.items.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    proteinG: sum.proteinG + item.proteinG,
    carbsG: sum.carbsG + item.carbsG,
    fatG: sum.fatG + item.fatG
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

  const logId = randomUUID();
  await database.transaction(async (tx) => {
    await tx.insert(foodLogs).values({
      id: logId,
      userId,
      mealType: input.mealType,
      inputMethod: input.inputMethod,
      imageUrl: input.imageUrl,
      totalCalories: totals.calories,
      totalProteinG: totals.proteinG,
      totalCarbsG: totals.carbsG,
      totalFatG: totals.fatG,
      confidenceScore: input.confidenceScore,
      notes: input.notes,
      loggedAt: input.loggedAt
    });
    await tx.insert(foodLogItems).values(input.items.map((item) => ({
      id: randomUUID(),
      foodLogId: logId,
      foodName: item.foodName,
      weightGrams: item.weightGrams,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      fiberG: item.fiberG,
      sugarG: item.sugarG,
      sodiumMg: item.sodiumMg
    })));
  });

  return { id: logId, mealType: input.mealType, inputMethod: input.inputMethod, totals, loggedAt: input.loggedAt, items: input.items };
}
