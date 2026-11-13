import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { deleteFavorite, listFavorites, parseFavoriteQuery, saveFavorite } from "../lib/foods/favorites";
const item = { foodName: "Nasi", weightGrams: 100, calories: 130, proteinG: 2.5, carbsG: 28, fatG: 0.3, fiberG: 0.4, sugarG: 0.1, sodiumMg: 1 };
test("favorites persist ordered components, paginate and isolate owners", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    for (const id of ["owner", "other"]) await database.insert(schema.users).values({ id, email: `${id}@example.test`, name: "Test", passwordHash: "test" });
    const first = await saveFavorite("owner", { inputMethod: "search", items: [item, { ...item, foodName: "Ayam" }] }, database);
    await saveFavorite("owner", { inputMethod: "photo", items: [{ ...item, foodName: "Sup" }] }, database);
    await saveFavorite("other", { inputMethod: "search", items: [item] }, database);
    const list = (query = "") => listFavorites("owner", parseFavoriteQuery(new URLSearchParams(query)), database);
    const filtered = await list("q=AYAM"); assert.equal(filtered.favorites.length, 1);
    assert.deepEqual(filtered.favorites[0].items.map(i => i.foodName), ["Nasi", "Ayam"]);
    assert.equal((await list("q=tidak-ada")).favorites.length, 0);
    const page = await list("limit=1"); assert.ok(page.nextCursor);
    const next = await list(`limit=1&cursor=${page.nextCursor}`);
    assert.equal(next.favorites.length, 1); assert.notEqual(next.favorites[0].id, page.favorites[0].id); assert.equal(next.nextCursor, null);
    await assert.rejects(deleteFavorite("other", first.id, database), /favorite_not_found/);
    await assert.rejects(saveFavorite("owner", { inputMethod: "search", items: [{ ...item, calories: -1 }] }, database));
    assert.equal((await list()).favorites.length, 2);
    await deleteFavorite("owner", first.id, database);
    assert.equal((await list("q=ayam")).favorites.length, 0);
    assert.equal((await database.select().from(schema.favoriteItems)).length, 2);
    for (const query of ["limit=0", "limit=51", "cursor=invalid", "q=" + "x".repeat(121)]) assert.throws(() => parseFavoriteQuery(new URLSearchParams(query)));
  } finally { client.close(); }
});
