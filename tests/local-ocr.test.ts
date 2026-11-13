import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeLocalLabel } from "../lib/ai/local-label";

// Opt-in integration test: uses a real worker and prepared local weights, no remote service.
test("real OCR workers read an image, reject overload, and recover after cancellation", { skip: process.env.RUN_LOCAL_OCR_TESTS !== "1", timeout: 60000 }, async () => {
  const bytes = await readFile(".caltrack/ocr/fixtures/eng-clear.jpg");
  const photo = () => new File([new Uint8Array(bytes)], "label.jpg", { type: "image/jpeg" });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(analyzeLocalLabel(photo(), "eng", controller.signal), /analysis_cancelled/);
  const cancelled = new AbortController();
  const pending = analyzeLocalLabel(photo(), "eng", cancelled.signal);
  const cancellation = assert.rejects(pending, /analysis_cancelled/);
  setTimeout(() => cancelled.abort(), 100);
  await cancellation;
  const a = analyzeLocalLabel(photo(), "eng", AbortSignal.timeout(25000));
  const b = analyzeLocalLabel(photo(), "eng", AbortSignal.timeout(25000));
  const rejected = assert.rejects(analyzeLocalLabel(photo(), "eng", AbortSignal.timeout(25000)), /analysis_rate_limited/);
  const [first, second] = await Promise.all([a, b, rejected]);
  assert.equal(first.nutrients.calories, 240); assert.equal(second.nutrients.sodiumMg, 120);
  const recovered = await analyzeLocalLabel(photo(), "eng", AbortSignal.timeout(25000));
  assert.equal(recovered.basis.amount, 100);
});
