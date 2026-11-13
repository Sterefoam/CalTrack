import { readFile, writeFile } from "node:fs/promises";
import { recognizeLocalLabel } from "../../lib/ai/local-label";
import { labelNutrientKeys } from "../../lib/nutrition/label";
import { parseLabelReadings } from "../../lib/nutrition/label-text";
import type { LabelLanguage } from "../../lib/nutrition/label-languages";
import { resolve, relative } from "node:path";

async function main() {
const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, process.argv[2] ?? ".caltrack/ocr/fixtures/manifest.json"), "utf8"));
const output = resolve(root, process.argv[3] ?? ".caltrack/ocr/evaluation.json");
const records = [];
for (const fixture of manifest.records) {
  const file = resolve(root, fixture.file);
  if (relative(resolve(root, ".caltrack/ocr"), file).startsWith("..")) throw new Error("Fixture outside OCR directory");
  const started = Date.now();
  let text: string[] | undefined;
  try {
    const bytes = await readFile(file);
    const recognized = await recognizeLocalLabel(new File([new Uint8Array(bytes)], "label.jpg", { type: "image/jpeg" }), fixture.language as LabelLanguage, AbortSignal.timeout(30000));
    text = recognized.map(reading => reading.text);
    const result = parseLabelReadings(recognized, fixture.language);
    if (!fixture.expected.nutrients) throw new Error("unexpected_nutrition_result");
    const fields = Object.fromEntries(labelNutrientKeys.map(key => [key, { expected: fixture.expected.nutrients[key], actual: result.nutrients[key], correct: fixture.expected.nutrients[key] === null ? result.nutrients[key] === null : result.nutrients[key] !== null && Math.abs(result.nutrients[key]! - fixture.expected.nutrients[key]) <= .1 }]));
    const basisCorrect = result.basis.amount === fixture.expected.basisAmount && result.basis.unit === fixture.expected.basisUnit;
    const passed = basisCorrect && Object.values(fields).every(field => field.correct);
    records.push({ id: fixture.id, language: fixture.language, variant: fixture.variant, kind: fixture.kind, passed, basisCorrect, fields, warnings: result.warnings, facts: result.facts, text, seconds: (Date.now() - started) / 1000 });
  } catch (error) { records.push({ id: fixture.id, language: fixture.language, variant: fixture.variant, kind: fixture.kind, passed: fixture.expected.error === (error instanceof Error ? error.message : "error"), error: error instanceof Error ? error.message : "error", text, seconds: (Date.now() - started) / 1000 }); }
  console.log(JSON.stringify({ id: fixture.id, passed: records.at(-1)?.passed, seconds: records.at(-1)?.seconds, error: records.at(-1)?.error }));
  await writeFile(output, JSON.stringify({ createdAt: new Date().toISOString(), engine: "Tesseract.js 6.0.1 + pinned official tessdata_best", developmentAcceptanceTest: true, notIndependentAccuracyBenchmark: true, records }, null, 2));
}
console.log(JSON.stringify({ samples: records.length, expectationsMet: records.filter(record => record.passed).length, completePositiveReads: records.filter(record => record.passed && record.fields && Object.values(record.fields).some(field => field.expected !== null)).length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
