import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { lookupBarcode, normalizeBarcode, parseOpenFoodProduct, searchFoods } from "../lib/foods/catalog";
const product = { product_name: "Oat uji", brands: "Pangan uji", serving_quantity: 40, serving_quantity_unit: "g", nutriments: { "energy-kcal_100g": 400, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 13, fiber_100g: 6, sugars_100g: 5, sodium_100g: 0.04 } };
test("barcode cache and literal name search use normalized nutrition units", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    let requests = 0;
    const options = { database, fetcher: async () => { requests++; return Response.json({ status: 1, product }); } };
    const result = await lookupBarcode("2000 0000 0001 5", new AbortController().signal, options);
    assert.equal(result.status, "found"); if (result.status !== "found") throw new Error();
    assert.equal(result.food.sodiumPer100g, 40); assert.equal(result.food.servingSizeG, 40);
    await lookupBarcode("2000000000015", new AbortController().signal, options); assert.equal(requests, 1);
    const offlineCache = await lookupBarcode("2000000000015", new AbortController().signal, { database, fetcher: async () => { throw new Error("provider offline"); } });
    assert.equal(offlineCache.status, "found");
    assert.equal((await searchFoods("OAT", 20, database)).length, 1);
    assert.equal((await searchFoods("pangan", 20, database)).length, 1);
    assert.equal((await searchFoods("%_", 20, database)).length, 0);
    assert.equal((await searchFoods("tidak ditemukan", 20, database)).length, 0);
    for (const [query, limit] of [["", 20], ["x", 20], ["x".repeat(121), 20], ["oat", 0], ["oat", 51], ["oat", 1.5]] as const) {
      await assert.rejects(searchFoods(query, limit, database), /invalid_food_search/);
    }
    const missing = await lookupBarcode("12345678", new AbortController().signal, { database, fetcher: async () => Response.json({ status: 0 }) }); assert.equal(missing.status, "not_found");
  } finally { client.close(); }
});
test("missing nutrition stays unknown and sodium converts from grams or salt", () => {
  const partial = parseOpenFoodProduct({ product_name: "Test", nutriments: { salt_100g: 1, "energy-kj_100g": 418.4 } }, "12345678");
  assert.equal(partial.nutrition.sodiumPer100g, 400); assert.equal(partial.nutrition.caloriesPer100g, 100);
  assert.equal(partial.nutrition.fiberPer100g, null); assert.ok(partial.missingFields.includes("fiberPer100g"));
  assert.throws(() => normalizeBarcode("<invalid>"));
});

test("barcode provider failures and incomplete products never enter the catalogue", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    const lookup = (fetcher: typeof fetch) => lookupBarcode("12345678", new AbortController().signal, { database, fetcher });
    const partial = await lookup(async () => Response.json({ status: 1, product: { product_name: "Belum lengkap", nutriments: { proteins_100g: " " } } }));
    assert.equal(partial.status, "incomplete");
    if (partial.status === "incomplete") assert.equal(partial.product.nutrition.proteinPer100g, null);
    assert.equal((await searchFoods("belum", 20, database)).length, 0);
    assert.equal((await lookup(async () => new Response(null, { status: 404 }))).status, "not_found");
    await assert.rejects(lookup(async () => { throw new Error("timeout"); }), /food_provider_unavailable/);
    await assert.rejects(lookup(async () => new Response(null, { status: 503 })), /food_provider_unavailable/);
    await assert.rejects(lookup(async () => new Response(null, { status: 429 })), /food_provider_unavailable/);
    await assert.rejects(lookup(async () => new Response("not JSON")), /invalid_food_provider_response/);
    for (const body of [null, [], { status: 1, product: [] }, { status: 2 }]) {
      await assert.rejects(lookup(async () => Response.json(body)), /invalid_food_provider_response/);
    }
  } finally { client.close(); }
});
