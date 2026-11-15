import assert from "node:assert/strict";
import test from "node:test";
import { hostedConfiguration } from "../lib/ai/provider-config";
import { requestFoodAnalysis } from "../lib/ai/food-analysis";
import { requestVisionJson } from "../lib/ai/vision-request";
import { transcribeAudio } from "../lib/ai/voice";
import { generateNutritionReply } from "../lib/chat/provider";
import { databaseConfiguration } from "../db/config";

const signal = () => new AbortController().signal;
const reply = (content: string, finish_reason = "stop") => Response.json({ choices: [{ finish_reason, message: { content } }] });

test("Groq routes chat, text and vision to trusted endpoints with distinct models", async () => {
  const calls: string[] = [];
  const options = { provider: "groq" as const, apiKey: "test-only", fetcher: async (url: unknown, init?: RequestInit) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-only");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, undefined);
    calls.push(body.model);
    if (body.response_format) {
      assert.equal(body.response_format.json_schema.strict, true);
      assert.match(body.messages[0].content, /Skema JSON:/);
      return reply(body.response_format.json_schema.name === "food_analysis" ? '{"items":[],"confidence_score":0}' : '{"language":"ja"}');
    }
    return reply("Tambahkan sayur pada makan siangmu.");
  } };
  assert.match(await generateNutritionReply([], signal(), options), /sayur/);
  await assert.rejects(requestFoodAnalysis("nasi", signal(), options), /no_food_detected/);
  assert.deepEqual(await requestVisionJson(Buffer.from("test"), "Read label", {}, signal(), options), { language: "ja" });
  assert.deepEqual(calls, ["openai/gpt-oss-20b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]);
});

test("Groq voice uses multilingual Whisper without sending audio to OpenAI", async () => {
  const bytes = Buffer.alloc(44); bytes.write("RIFF"); bytes.write("WAVE", 8);
  const audio = new File([bytes], "input.wav", { type: "audio/wav" });
  const text = await transcribeAudio(audio, signal(), { provider: "groq", apiKey: "test-only", fetcher: async (url, init) => {
    assert.equal(url, "https://api.groq.com/openai/v1/audio/transcriptions");
    assert.equal((init?.body as FormData).get("model"), "whisper-large-v3-turbo");
    return Response.json({ text: "Makan nasi dan tahu" });
  } });
  assert.equal(text, "Makan nasi dan tahu");
});

test("Groq failures stay on selected provider and reject incomplete replies", async () => {
  let calls = 0;
  const options = { provider: "groq" as const, apiKey: "test-only", fetcher: async () => { calls++; return new Response(null, { status: 429 }); } };
  await assert.rejects(generateNutritionReply([], signal(), options), /ai_rate_limited/);
  await assert.rejects(requestFoodAnalysis("nasi", signal(), options), /ai_rate_limited/);
  assert.equal(calls, 2);
  await assert.rejects(generateNutritionReply([], signal(), { ...options, fetcher: async () => reply("Terpotong", "length") }), /invalid_chat_response/);
  await assert.rejects(requestVisionJson(Buffer.from("test"), "read", {}, signal(), { ...options, fetcher: async () => reply("not JSON") }), /invalid_ai_response/);
  const previous = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    await assert.rejects(requestFoodAnalysis("nasi", signal(), { provider: "groq", fetcher: options.fetcher }), /ai_not_configured/);
    assert.equal(calls, 2);
  } finally { if (previous !== undefined) process.env.GROQ_API_KEY = previous; }
  assert.equal(hostedConfiguration({ apiKey: "test-only" }).provider, "openai");
});

test("Vercel requires authenticated remote persistence; local development keeps SQLite", () => {
  assert.deepEqual(databaseConfiguration({}), { url: "file:./caltrack.db" });
  for (const env of [{ VERCEL: "1" }, { VERCEL: "1", DATABASE_URL: "file:./caltrack.db" }, { TURSO_DATABASE_URL: "libsql://test.turso.io" }]) {
    assert.throws(() => databaseConfiguration(env));
  }
  assert.deepEqual(databaseConfiguration({ VERCEL: "1", TURSO_DATABASE_URL: "libsql://test.turso.io", TURSO_AUTH_TOKEN: "test-only" }), { url: "libsql://test.turso.io", authToken: "test-only" });
});
