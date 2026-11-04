import assert from "node:assert/strict";
import test from "node:test";
import { analyzeText } from "../lib/ai/text";
import { analyzeVoice, transcribeAudio } from "../lib/ai/voice";
const signal = () => new AbortController().signal;
test("voice transcribes Indonesian before parsing the same nutrition contract", async () => {
  const calls: string[] = [];
  const wav = Buffer.alloc(44); wav.write("RIFF", 0); wav.write("WAVE", 8);
  const audio = new File([new Uint8Array(wav)], "user-file.wav", { type: "audio/wav" });
  const result = await analyzeVoice(audio, signal(), { apiKey: "test-only", fetcher: async (url, init) => {
    calls.push(String(url));
    if (String(url).endsWith("transcriptions")) {
      const form = init?.body as FormData;
      assert.equal(form.get("language"), "id"); assert.equal((form.get("file") as File).name, "recording.wav");
      return Response.json({ text: "Makan nasi 200 gram" });
    }
    const body = JSON.parse(String(init?.body)); assert.equal(body.messages[1].content, "Makan nasi 200 gram");
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ items: [{ food_name: "Nasi", estimated_weight_grams: 200, calories: 260, macros: { protein_g: 5, carbs_g: 56, fat_g: 0.6 }, micros: { fiber_g: 0.8, sugar_g: 0.2, sodium_mg: 2 }, confidence_score: 0.8 }], confidence_score: 0.8 }) } }] });
  } });
  assert.equal(calls.length, 2); assert.equal(result.transcript, "Makan nasi 200 gram"); assert.equal(result.items[0].calories, 260); assert.equal(result.requiresConfirmation, true);
});
test("text and audio validation prevent provider calls for invalid input", async () => {
  const options = { apiKey: "test-only", fetcher: async () => { throw new Error("provider must not run"); } };
  for (const text of ["", "a", "x".repeat(1001), 123]) await assert.rejects(analyzeText(text, signal(), options), /invalid_food_text/);
  await assert.rejects(transcribeAudio(new File(["fake"], "fake.webm", { type: "audio/webm" }), signal(), options), /invalid_audio/);
  await assert.rejects(transcribeAudio(new File(["fake"], "fake.txt", { type: "text/plain" }), signal(), options), /unsupported_audio/);
});
