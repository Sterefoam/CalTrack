import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { expandedDataset } from "./dataset.mjs";

const root = fileURLToPath(new URL("../../.caltrack/ml/", import.meta.url));
const read = async name => JSON.parse(await readFile(join(root, name), "utf8"));
const legacy = await read("manifest.json");
const commons = await read("manifest-v2.json");
const openimages = await read("manifest-openimages.json");
const records = [...commons.records, ...openimages.records];
if (new Set(records.map(row => row.id)).size !== records.length) throw new Error("Duplicate source IDs");
let frozenRows = [];
try { frozenRows = (await read("split-v2.json")).rows; } catch (error) { if (error.code !== "ENOENT") throw error; }
const split = expandedDataset(records, { legacyIds: legacy.records.map(row => row.id), frozenRows });
split.protocol = "caltrack-expansion-v2-multisource";
split.sources = ["Wikimedia Commons", "Open Images v5 official validation and test subsets (repartitioned for CalTrack)"];
split.collection = { commons: commons.records.length, openimages: openimages.records.length, total: records.length };
await writeFile(join(root, "split-v2.json"), JSON.stringify(split, null, 2));
console.log(JSON.stringify({ collection: split.collection, classes: Object.keys(split.counts).length,
  independentlyTestedClasses: split.testedLabels.length, unmeasuredClasses: split.unmeasuredLabels.length,
  eligible: split.rows.length, excluded: split.excluded.length,
  counts: Object.fromEntries(["train","validation","test"].map(part => [part,split.rows.filter(row => row.split === part).length])) }, null, 2));
