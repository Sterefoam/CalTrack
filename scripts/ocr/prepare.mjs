import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../../.caltrack/ocr/", import.meta.url);
const languages = ["eng", "ind", "fra", "spa", "deu", "jpn", "ara", "chi_sim", "hin"];
const revision = "e12c65a915945e4c28e237a9b52bc4a8f39a0cec";
await mkdir(root, { recursive: true });
async function download(url, limit) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { "User-Agent": "CalTrack-OCR-Evaluation/1.0" } });
  if (!response.ok) throw new Error(`Language model download failed: HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > limit) { await response.body?.cancel(); throw new Error("Model too large"); }
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new Error("Model too large"); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
let manifest;
try { manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!manifest) {
  manifest = { repository: "https://github.com/tesseract-ocr/tessdata_best", revision, license: "Apache-2.0", models: {} };
}
if (manifest.revision !== revision) throw new Error("OCR revision differs from the evaluated version");
for (const language of languages) {
  const destination = new URL(`${language}.traineddata`, root);
  if (manifest.models[language]) {
    const bytes = await readFile(destination);
    if (createHash("sha256").update(bytes).digest("hex") !== manifest.models[language].sha256) throw new Error("Cached OCR model changed");
    continue;
  }
  const source = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/${manifest.revision}/${language}.traineddata`;
  const bytes = await download(source, 40_000_000);
  if (bytes.length < 100000) throw new Error("Invalid OCR model size");
  const temporary = new URL(`${language}.tmp`, root); await writeFile(temporary, bytes); await rename(temporary, destination);
  manifest.models[language] = { source, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  await writeFile(new URL("manifest.json", root), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ language, prepared: true, bytes: bytes.length }));
}
console.log(JSON.stringify({ languages: Object.keys(manifest.models), ready: true, revision: manifest.revision }));
