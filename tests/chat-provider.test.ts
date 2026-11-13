import assert from "node:assert/strict";
import test from "node:test";
import { chatStatus, generateNutritionReply } from "../lib/chat/provider";

test("Ollama uses private server URL, disables thinking and validates complete replies", async () => {
  const options = { provider: "ollama" as const, baseUrl: "http://model:11434", model: "qwen3:4b", fetcher: async (url: unknown, init?: RequestInit) => {
    assert.equal(url, "http://model:11434/api/chat");
    const body = JSON.parse(String(init?.body)); assert.equal(body.think, false); assert.equal(body.stream, false); assert.equal(body.model, "qwen3:4b");
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return Response.json({ done: true, done_reason: "stop", message: { content: "Coba tumis tahu dan bayam." } });
  } };
  assert.equal(await generateNutritionReply([{ role: "user", content: "Menu?" }], new AbortController().signal, options), "Coba tumis tahu dan bayam.");
  await assert.rejects(generateNutritionReply([], new AbortController().signal, { ...options, fetcher: async () => Response.json({ done: true, done_reason: "length", message: { content: "Terpotong" } }) }), /invalid_chat_response/);
  await assert.rejects(generateNutritionReply([], new AbortController().signal, { ...options, fetcher: async () => { throw new Error("connection refused"); } }), /chat_unavailable/);
});
test("Ollama status requires the configured model to actually be installed", async () => {
  const options = { provider: "ollama" as const, model: "qwen3:4b", fetcher: async () => Response.json({ models: [{ name: "other:latest" }] }) };
  assert.equal((await chatStatus(options)).ready, false);
  assert.equal((await chatStatus({ ...options, fetcher: async () => Response.json({ models: [{ name: "qwen3:4b" }] }) })).ready, true);
});
