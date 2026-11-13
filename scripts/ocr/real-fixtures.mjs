// A small acceptance set, manually annotated from the visible photos, not database nutrients.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const directory = new URL("../../.caltrack/ocr/real/", import.meta.url);
await mkdir(directory, { recursive: true });
const unknown = { calories: null, proteinG: null, carbsG: null, fatG: null, fiberG: null, sugarG: null, sodiumMg: null };
const definitions = [
  { language: "eng", revision: 822, author: "openfoodfacts-contributors", id: "eng-front-negative", outcome: "reject-front-without-table", expected: { error: "no_nutrition_label" } },
  { language: "spa", revision: 231, author: "openfoodfactsmx", id: "spa-serving", outcome: "read-visible-single-column", expected: { basisAmount: 18, basisUnit: "g", nutrients: { calories: 100, proteinG: 1, carbsG: 10, fatG: 6, fiberG: null, sugarG: 10, sodiumMg: 10 } } },
  { language: "fra", revision: 829, author: "municorn-calorie-counter-app", id: "fra-multi-column", outcome: "abstain-or-reject-multiple-columns", expected: { error: "no_nutrition_label", basisAmount: null, basisUnit: "unknown", nutrients: unknown } },
  { language: "eng", code: "5449000000996", revision: 1173, author: "macrofactor", id: "coke-eng-multi-column", outcome: "abstain-or-reject-multiple-columns", expected: { error: "no_nutrition_label", basisAmount: null, basisUnit: "unknown", nutrients: unknown } },
  { language: "deu", code: "5449000000996", revision: 609, author: "lwt2", id: "coke-deu-multi-column", outcome: "abstain-or-reject-multiple-columns", expected: { error: "no_nutrition_label", basisAmount: null, basisUnit: "unknown", nutrients: unknown } },
  { language: "fra", code: "5000159459228", revision: 236, author: "aleene", id: "twix-fra-multi-column", outcome: "abstain-or-reject-multiple-columns", expected: { error: "no_nutrition_label", basisAmount: null, basisUnit: "unknown", nutrients: unknown } },
];
const records = [];
for (const definition of definitions) {
  const code = { eng: "en", spa: "es", fra: "fr", deu: "de" }[definition.language];
  const product = definition.code ?? "3017620422003";
  const path = [product.slice(0, 3), product.slice(3, 6), product.slice(6, 9), product.slice(9)].join("/");
  const url = `https://images.openfoodfacts.org/images/products/${path}/nutrition_${code}.${definition.revision}.full.jpg`;
  const response = await fetch(url, { headers: { "User-Agent": "CalTrack/0.1 (local nutrition OCR acceptance tests)" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`Photo download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Photo too large");
  await writeFile(new URL(`${definition.id}.jpg`, directory), bytes);
  records.push({ ...definition, kind: "real-package-photo", variant: "original-selected-photo", file: `.caltrack/ocr/real/${definition.id}.jpg`, source: url,
    license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", attribution: `${definition.author}, Open Food Facts contributors`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    notes: definition.language === "spa" ? "Visible fiber is Menos de 1 g: keep unknown, not 0 or 1. Printed 400 kJ / 100 kcal are rounded." : definition.outcome.includes("multiple-columns") ? "Multiple amount/reference columns. Never combine their values." : "Selected nutrition URL actually shows the front of the jar. Never assume metadata guarantees a nutrition table." });
  const rectangle = definition.id === "coke-eng-multi-column" ? { left: 325, top: 390, width: 298, height: 380 } : definition.id === "coke-deu-multi-column" ? { left: 0, top: 0, width: 935, height: 952 } : null;
  if (rectangle) {
    const id = definition.id.replace("multi-column", "single-column-crop");
    const crop = await sharp(bytes).extract(rectangle).jpeg({ quality: 95 }).toBuffer();
    await writeFile(new URL(`${id}.jpg`, directory), crop);
    records.push({ ...records.at(-1), id, variant: "manually-isolated-100ml-column", outcome: "read-visible-single-column", file: `.caltrack/ocr/real/${id}.jpg`,
      sha256: createHash("sha256").update(crop).digest("hex"), transformation: { crop: rectangle, reencodedJpeg: true },
      expected: { basisAmount: 100, basisUnit: "ml", nutrients: { calories: 42, proteinG: 0, carbsG: 10.6, fatG: 0, fiberG: null, sugarG: 10.6, sodiumMg: 0 } },
      notes: "Manually cropped to include nutrient names and only the printed 100 ml column. Missing fiber stays unknown. Nutrition ground truth transcribed visually, not from the product database." });
  }
}
await writeFile(new URL("manifest.json", directory), JSON.stringify({ source: "Open Food Facts, Nutella, Coca-Cola and Twix; manual visual annotation of each original photo", notIndependentAccuracyBenchmark: true, records }, null, 2));
console.log(JSON.stringify({ photosAndCrops: records.length, singleColumnPositive: 3, rejectionOrAbstentionCases: 5 }));
