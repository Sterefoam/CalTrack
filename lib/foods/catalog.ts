import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { foods } from "@/db/schema";
import { InputError } from "@/lib/http/json";

export function normalizeBarcode(value: string) {
  const code = value.replace(/[\s-]/g, "");
  if (!/^(?:\d{8}|\d{12,14})$/.test(code)) throw new InputError("invalid_barcode");
  return code;
}
function nutrient(value: unknown, max: number): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}
export function parseOpenFoodProduct(product: Record<string, unknown>, barcode: string) {
  const n = product.nutriments && typeof product.nutriments === "object" ? product.nutriments as Record<string, unknown> : {};
  const kcal = nutrient(n["energy-kcal_100g"], 2000);
  const kj = nutrient(n["energy-kj_100g"] ?? n.energy_100g, 8368);
  const sodium = nutrient(n.sodium_100g, 100);
  const salt = nutrient(n.salt_100g, 250);
  const nutrition = {
    caloriesPer100g: kcal ?? (kj === null ? null : Math.round(kj / 4.184 * 10) / 10),
    proteinPer100g: nutrient(n.proteins_100g, 100), carbsPer100g: nutrient(n.carbohydrates_100g, 100), fatPer100g: nutrient(n.fat_100g, 100),
    fiberPer100g: nutrient(n.fiber_100g, 100), sugarPer100g: nutrient(n.sugars_100g, 100),
    sodiumPer100g: sodium === null ? (salt === null ? null : Math.round(salt / 2.5 * 1000)) : Math.round(sodium * 1000)
  };
  const name = typeof product.product_name === "string" ? product.product_name.trim().slice(0,120) : "";
  const brand = typeof product.brands === "string" ? product.brands.trim().slice(0,120) : null;
  const missingFields = Object.entries(nutrition).filter(([,value]) => value === null).map(([key]) => key);
  const serving = product.serving_quantity_unit === "g" ? nutrient(product.serving_quantity, 10000) : null;
  return { name, brand, barcode, servingSizeG: serving && serving > 0 ? serving : 100, nutrition, missingFields: name ? missingFields : ["name", ...missingFields] };
}

export async function lookupBarcode(raw: string, signal: AbortSignal, options: { database?: typeof db; fetcher?: typeof fetch } = {}) {
  const barcode = normalizeBarcode(raw);
  const database = options.database ?? db;
  const [cached] = await database.select().from(foods).where(eq(foods.barcode, barcode)).limit(1);
  if (cached) return { status: "found" as const, food: cached };
  const fields = "product_name,brands,serving_quantity,serving_quantity_unit,nutriments";
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(7000)]), headers: { "User-Agent": process.env.OPENFOODFACTS_USER_AGENT ?? "CalTrack/0.1 (local development)" } });
  } catch { throw new InputError("food_provider_unavailable", 503); }
  if (response.status === 404) return { status: "not_found" as const, barcode };
  if (!response.ok) throw new InputError("food_provider_unavailable", 503);
  let data;
  try { data = await response.json(); } catch { throw new InputError("invalid_food_provider_response", 502); }
  if (data.status === 0) return { status: "not_found" as const, barcode };
  if (data.status !== 1 || !data.product || typeof data.product !== "object") throw new InputError("invalid_food_provider_response", 502);
  const parsed = parseOpenFoodProduct(data.product, barcode);
  if (parsed.missingFields.length) return { status: "incomplete" as const, product: parsed };
  const value = { name: parsed.name, brand: parsed.brand, barcode, servingSizeG: parsed.servingSizeG, source: "openfoodfacts" as const, ...parsed.nutrition } as typeof foods.$inferInsert;
  await database.insert(foods).values(value).onConflictDoNothing({ target: foods.barcode });
  const [food] = await database.select().from(foods).where(eq(foods.barcode, barcode)).limit(1);
  return { status: "found" as const, food };
}

export async function searchFoods(query: string, limit = 20, database = db) {
  const text = query.trim().toLowerCase();
  if (text.length < 2 || text.length > 120 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new InputError("invalid_food_search");
  return database.select().from(foods).where(or(sql`instr(lower(${foods.name}), ${text}) > 0`, sql`instr(lower(coalesce(${foods.brand}, '')), ${text}) > 0`)).orderBy(foods.name, foods.id).limit(limit);
}
