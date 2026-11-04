import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { getFoodHistory, parseHistoryQuery } from "../lib/food-logs/history";

test("history pagination handles tied times, date boundaries, filters and user isolation", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values(["a", "b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test" })));
    for (const [id, userId, loggedAt] of [["1","a","2026-11-02T17:00:00Z"], ["2","a","2026-11-03T10:00:00Z"], ["3","a","2026-11-03T10:00:00Z"], ["4","a","2026-11-03T17:00:00Z"], ["5","b","2026-11-03T10:00:00Z"]]) {
      await database.insert(schema.foodLogs).values({ id, userId, loggedAt: new Date(loggedAt), mealType: "lunch", inputMethod: "text", totalCalories: 100 });
      await database.insert(schema.foodLogItems).values({ foodLogId: id, foodName: id === "2" ? "Ayam" : "Nasi", weightGrams: 100, calories: 100 });
    }
    const params = new URLSearchParams("date=2026-11-03&limit=2");
    const first = await getFoodHistory("a", parseHistoryQuery(params), database);
    assert.deepEqual(first.logs.map(log => log.id), ["3", "2"]);
    assert.equal(first.summary.count, 3); assert.equal(first.summary.calories, 300);
    assert.ok(first.nextCursor); params.set("cursor", first.nextCursor);
    const next = await getFoodHistory("a", parseHistoryQuery(params), database);
    assert.deepEqual(next.logs.map(log => log.id), ["1"]); assert.equal(next.nextCursor, null);
    const filtered = await getFoodHistory("a", parseHistoryQuery(new URLSearchParams("date=2026-11-03&q=ayam")), database);
    assert.deepEqual(filtered.logs.map(log => log.id), ["2"]); assert.equal(filtered.logs[0].items[0].foodName, "Ayam");
    for (const query of ["date=2026-02-30", "limit=1000", "mealType=invalid", "cursor=broken!"]) assert.throws(() => parseHistoryQuery(new URLSearchParams(query)));
  } finally { client.close(); }
});
