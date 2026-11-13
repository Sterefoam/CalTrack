import test from "node:test";
import assert from "node:assert/strict";
import { api, jsonRequest, loadFoodHistory } from "../lib/client/api";
import { catalogPortion, type CatalogEntry } from "../lib/client/catalog";

test("account requests retain cookie session and surface failures without demo fallback", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.credentials, "same-origin"); assert.equal(options?.cache, "no-store");
      assert.deepEqual(JSON.parse(String(options?.body)), { name: "Nasi" });
      return Response.json({ error: "authentication_required" }, { status: 401 });
    };
    await assert.rejects(api("/api/food-logs", jsonRequest("POST", { name: "Nasi" })), /Sesi akun berakhir/);
    globalThis.fetch = async () => { throw new TypeError("network down"); };
    await assert.rejects(api("/api/food-logs"), /Periksa riwayat/);
  } finally { globalThis.fetch = original; }
});

test("account history consumes every cursor page and keeps local calendar dates", async () => {
  const original = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = async (url) => {
      const parsed = new URL(String(url), "http://localhost");
      assert.equal(parsed.searchParams.get("date"), "2026-11-05");
      assert.equal(parsed.searchParams.get("cursor"), calls ? "second" : null);
      calls++;
      return Response.json({ logs: [{ id: String(calls), loggedAt: "2026-11-05T12:00:00Z", mealType: "lunch", items: [] }], nextCursor: calls === 1 ? "second" : null });
    };
    const result = await loadFoodHistory("2026-11-05");
    assert.equal(calls, 2); assert.deepEqual(result.map((log) => log.id), ["1", "2"]);
    assert.equal(result[0].date, "2026-11-05");
  } finally { globalThis.fetch = original; }
});

test("server catalogue portions scale milligrams and reject unknown nutrients", () => {
  const food: CatalogEntry = { id: "rice", name: "Nasi", brand: null, source: "manual", servingSizeG: 100, caloriesPer100g: 130, proteinPer100g: 2.5, carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, sugarPer100g: 0.1, sodiumPer100g: 10 };
  const item = catalogPortion(food, 150)!;
  assert.equal(item.calories, 195); assert.equal(item.sodiumMg, 15);
  assert.equal(catalogPortion({ ...food, sodiumPer100g: null }, 150), null);
  assert.equal(catalogPortion(food, NaN), null);
});
