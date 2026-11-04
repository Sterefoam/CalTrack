import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { listConversations, readConversation, sendNutritionMessage } from "../lib/chat/service";
test("nutrition chat derives context from the database and persists user-scoped exchanges", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema }); await migrate(database, { migrationsFolder: "./drizzle" });
    await database.insert(schema.users).values(["a","b"].map(id => ({ id, email: `${id}@example.test`, name: id, passwordHash: "test" })));
    await database.insert(schema.nutritionTargets).values({ userId: "a", bmr: 1500, tdee: 2000, targetCalories: 2000, targetProteinG: 100, targetCarbsG: 250, targetFatG: 60 });
    let calls = 0;
    const options = { database, apiKey: "test-only", fetcher: async (_url: unknown, init?: RequestInit) => {
      calls++; const body = JSON.parse(String(init?.body)); assert.match(body.messages[0].content, /sisa kalori 2000 kkal/); assert.equal(body.store, false);
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: "Coba nasi, ayam, dan sayuran dengan porsi yang sesuai." } }] });
    } };
    const first = await sendNutritionMessage("a", { message: "Saran makan?", remainingCalories: 1 }, new AbortController().signal, options);
    assert.equal(first.remainingCalories, 2000); assert.equal((await listConversations("a", database)).length, 1);
    await sendNutritionMessage("a", { message: "Bagaimana proteinnya?", conversationId: first.conversationId }, new AbortController().signal, options);
    const history = await readConversation("a", first.conversationId, database);
    assert.deepEqual(history.messages.map(message => message.role), ["user", "assistant", "user", "assistant"]);
    await assert.rejects(sendNutritionMessage("b", { message: "Baca ini", conversationId: first.conversationId }, new AbortController().signal, options), /conversation_not_found/);
    assert.equal(calls, 2); assert.deepEqual(await listConversations("b", database), []);
    await assert.rejects(sendNutritionMessage("a", { message: "Pesan gagal" }, new AbortController().signal, { ...options, fetcher: async () => new Response("private provider error", { status: 500 }) }), /chat_unavailable/);
    assert.equal((await database.select().from(schema.chatMessages)).length, 4);
    assert.equal((await database.select().from(schema.chatConversations)).length, 1);
  } finally { client.close(); }
});
