import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sharp from "sharp";
import { sourceClasses } from "./classes.mjs";
import { acceptedLicense, allowedImageUrl, plainText, sha256 } from "./core.mjs";
import { expansionSplit } from "./dataset.mjs";

const root = fileURLToPath(new URL("../../.caltrack/ml/", import.meta.url));
const perClass = Number(process.env.ML_IMAGES_PER_CLASS ?? 80);
if (!Number.isInteger(perClass) || perClass < 30 || perClass > 500) throw new Error("ML_IMAGES_PER_CLASS must be 30–500");
await mkdir(join(root, "images"), { recursive: true });
const legacy = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
let manifest;
try { manifest = JSON.parse(await readFile(join(root, "manifest-v2.json"), "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const records = new Map((manifest?.records ?? legacy.records).map(row => [row.id, row]));
const errors = [], rejected = new Set(manifest?.rejectedIds ?? []);
const digests = new Map([...records.values()].map(row => [row.sha256, row.id]));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let cooldownUntil = 0;
async function save(name, value) {
  await writeFile(join(root, `${name}.tmp`), JSON.stringify(value, null, 2));
  await rename(join(root, `${name}.tmp`), join(root, name));
}
async function fetchBounded(url, maxBytes) {
  for (let attempt = 0; attempt < 3; attempt++) {
    while (Date.now() < cooldownUntil) await sleep(Math.min(1000, cooldownUntil - Date.now()));
    const response = await fetch(url, { headers: { "User-Agent": "CalTrack-Research/0.2 (licensed food-image study)" }, signal: AbortSignal.timeout(20000), redirect: "error" });
    if ([429, 503].includes(response.status)) {
      await response.body?.cancel();
      if (attempt === 2) throw new Error(`Rate limited ${response.status}`);
      const header = response.headers.get("Retry-After");
      const seconds = Number(header) || (header ? Math.max(0, (Date.parse(header) - Date.now()) / 1000) : 0);
      cooldownUntil = Math.max(cooldownUntil, Date.now() + Math.max(response.status === 429 ? 60 : 5, seconds || 4 * (attempt + 1)) * 1000);
      console.log(`Provider backoff ${response.status}; waiting before further requests`);
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    if (Number(response.headers.get("content-length")) > maxBytes) { await response.body?.cancel(); throw new Error("Response too large"); }
    const reader = response.body.getReader(), chunks = []; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.length;
        if (bytes > maxBytes) { await reader.cancel(); throw new Error("Response too large"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
  }
}
async function api(params) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", format: "json", maxlag: "5", ...params }).toString();
  const result = JSON.parse((await fetchBounded(url, 5_000_000)).toString("utf8"));
  if (result.error) throw new Error(result.error.code);
  return result;
}
async function checkpoint() {
  await save("manifest-v2.json", { source: "Wikimedia Commons", version: 2, perClass, sourceClasses: sourceClasses.length, records: [...records.values()], rejectedIds: [...rejected], errors, updatedAt: new Date().toISOString() });
}
let interrupted = false;
process.on("SIGINT", () => { interrupted = true; });
const collectionOrder = [...sourceClasses.slice(25), ...sourceClasses.slice(0, 25)];
for (const [classIndex, [label, category]] of collectionOrder.entries()) {
  if (interrupted) break;
  let count = [...records.values()].filter(row => row.label === label).length;
  const categories = [category];
  if (count < perClass) try {
    const data = await api({ list: "categorymembers", cmtitle: `Category:${category}`, cmtype: "subcat", cmlimit: "12" });
    categories.push(...(data.query?.categorymembers ?? []).map(item => item.title.replace(/^Category:/, "")));
  } catch (error) { errors.push({ label, stage: "subcategories", reason: error.message }); }
  for (const currentCategory of categories) {
    let continuation;
    for (let page = 0; page < 6 && count < perClass && !interrupted; page++) {
      let data;
      try { data = await api({ generator: "categorymembers", gcmtitle: `Category:${currentCategory}`, gcmtype: "file", gcmlimit: "50", prop: "imageinfo", iiprop: "url|extmetadata|size", ...(continuation ?? {}) }); }
      catch (error) { errors.push({ label, stage: "metadata", reason: error.message }); break; }
      const entries = Object.values(data.query?.pages ?? {});
      // Two concurrent bounded downloads; metadata requests remain sequential.
      for (let i = 0; i < entries.length && count < perClass && !interrupted; i += 2) {
        await Promise.all(entries.slice(i, i + Math.min(2, perClass - count)).map(async entry => {
          const id = String(entry.pageid), info = entry.imageinfo?.[0];
          if (records.has(id)) {
            const row = records.get(id);
            if (row.label !== label) row.ambiguousLabels = [...new Set([...(row.ambiguousLabels ?? []), label])];
            return;
          }
          if (rejected.has(id) || !info || !/\.(?:jpe?g|png|webp)$/i.test(entry.title) || Math.min(info.width, info.height) < 224 || info.size > 10_000_000 || info.width * info.height > 45_000_000) return;
          if (/(?:logo|icon|diagram|poster|menu|book cover|statue)/i.test(entry.title)) { rejected.add(id); return; }
          const license = acceptedLicense(info.extmetadata ?? {});
          if (!license) { rejected.add(id); return; }
          try {
            // Download bounded originals; do not ask Commons to generate thumbnails.
            const imageUrl = allowedImageUrl(info.url);
            const buffer = await fetchBounded(imageUrl, 10_000_000);
            const image = sharp(buffer, { limitInputPixels: 45_000_000, failOn: "error" });
            if ((await image.metadata()).pages > 1) { rejected.add(id); return; }
            const normalized = await image.rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
            const pixels = await sharp(normalized).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer();
            let hash = 0n; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) hash = (hash << 1n) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? 1n : 0n);
            const digest = sha256(normalized);
            if (digests.has(digest)) {
              const prior = records.get(digests.get(digest));
              if (prior.label !== label) prior.ambiguousLabels = [...new Set([...(prior.ambiguousLabels ?? []), label])];
              return;
            }
            digests.set(digest, id);
            await writeFile(join(root, "images", `${id}.jpg`), normalized);
            records.set(id, { id, label, category: currentCategory, rootCategory: category, title: entry.title, file: `images/${id}.jpg`, sha256: digest, dhash: hash.toString(16).padStart(16, "0"), license, sourceUrl: info.descriptionurl, originalUrl: allowedImageUrl(info.url), downloadUrl: imageUrl, description: plainText(info.extmetadata.ImageDescription?.value).slice(0, 1000), retrievedAt: new Date().toISOString(), modifications: "Resized to <=512px, JPEG re-encoded, metadata stripped", labelStatus: "weak-category-label-unreviewed" });
            count++;
          } catch (error) { errors.push({ id, label, reason: error.message }); }
        }));
        await sleep(350);
      }
      await checkpoint();
      continuation = data.continue;
      if (!continuation) break;
      await sleep(600);
    }
    if (count >= perClass || interrupted) break;
  }
  await checkpoint();
  console.log(`${classIndex + 1}/${sourceClasses.length} ${label}: ${count} licensed images; total=${records.size}; errors=${errors.length}`);
}
let frozenRows = [];
try { frozenRows = JSON.parse(await readFile(join(root, "split-v2.json"), "utf8")).rows; } catch (error) { if (error.code !== "ENOENT") throw error; }
const split = expansionSplit([...records.values()], { legacyIds: legacy.records.map(row => row.id), frozenRows });
await save("split-v2.json", split);
console.log(JSON.stringify({ downloaded: records.size, eligible: split.rows.length, classes: Object.keys(split.counts).length, excluded: split.excluded.length, interrupted }));
