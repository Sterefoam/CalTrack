import { readFile, writeFile } from "node:fs/promises";
import { duplicateGroups } from "./dataset.mjs";
import { sha256 } from "./core.mjs";

export function refinementDataset(previous, records) {
  const labels = Object.keys(previous.counts).sort();
  const old = new Map(previous.rows.map(row => [row.id, row]));
  const excludedIds = new Set(previous.excluded.map(row => row.id));
  const rows = [], excluded = [], candidates = new Map(labels.map(label => [label, []]));
  const ids = new Set();
  for (const row of records) { if (ids.has(row.id)) throw new Error("Duplicate collection ID"); ids.add(row.id); }
  for (const group of duplicateGroups(records)) {
    const groupLabels = new Set(group.flatMap(row => [row.label, ...(row.ambiguousLabels ?? [])]));
    const previousParts = new Set(group.filter(row => old.has(row.id)).map(row => old.get(row.id).split));
    if (groupLabels.size !== 1 || previousParts.has("test") || previousParts.size > 1 || group.some(row => excludedIds.has(row.id))) {
      excluded.push(...group.map(row => ({ id: row.id, reason: previousParts.has("test") ? "v2-test-retired-and-quarantined" : "conflicting-or-previously-excluded-group" })));
      continue;
    }
    const label = group[0].label;
    if (!candidates.has(label)) { excluded.push(...group.map(row => ({ id: row.id, reason: "outside-frozen-v2-labels" }))); continue; }
    const groupId = sha256(group.map(row => row.id).sort().join("|"));
    if (previousParts.size) {
      const split = [...previousParts][0];
      for (const row of group) {
        // Keep one representative of every validation duplicate group.
        if (split === "validation" && !old.has(row.id)) { excluded.push({ id: row.id, reason: "old-validation-duplicate" }); continue; }
        rows.push({ ...row, split, groupId, fresh: false });
      }
    } else candidates.get(label).push({ group, groupId });
  }
  for (const [label, groups] of candidates) {
    groups.sort((a, b) => sha256(`refinement-v3:${a.groupId}`).localeCompare(sha256(`refinement-v3:${b.groupId}`)));
    const heldout = groups.length >= 20 ? Math.max(5, Math.floor(groups.length * 0.2)) : 0;
    groups.forEach(({ group, groupId }, index) => {
      const split = index < heldout ? "test" : index < 2 * heldout ? "validation" : "train";
      group.sort((a, b) => a.id.localeCompare(b.id));
      for (const [j, row] of group.entries()) {
        if (split !== "train" && j > 0) { excluded.push({ id: row.id, reason: "fresh-heldout-duplicate" }); continue; }
        rows.push({ ...row, split, groupId, fresh: true });
      }
    });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  const counts = Object.fromEntries(labels.map(label => [label, Object.fromEntries(["train", "validation", "test"].map(part => [part, rows.filter(row => row.label === label && row.split === part).length]))]));
  if (Object.values(counts).some(parts => parts.train < 5)) throw new Error("Insufficient training coverage for a frozen category");
  if (rows.filter(row => row.split === "test").length < 50) throw new Error("Need at least 50 fresh independent test photos");
  return { protocol: "caltrack-refinement-v3-fresh-test", labels, rows, counts, excluded,
    policy: "v2 train remains train; v2 validation remains validation; all v2 test/previous exclusions quarantined including duplicate groups; fresh-only final test; labels frozen to v2",
    testedLabels: labels.filter(label => counts[label].test > 0),
    unmeasuredLabels: labels.filter(label => counts[label].test === 0) };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/build-refinement.mjs")) {
  const root = new URL("../../.caltrack/ml/", import.meta.url);
  const read = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
  const [previous, commons, openimages] = await Promise.all([read("split-v2.json"), read("manifest-v2.json"), read("manifest-openimages.json")]);
  const split = refinementDataset(previous, [...commons.records, ...openimages.records]);
  const target = new URL("split-v3.json", root);
  try { await readFile(target); throw new Error("v3 split already frozen; do not overwrite"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(target, JSON.stringify(split, null, 2));
  console.log(JSON.stringify({ classes: split.labels.length, testedClasses: split.testedLabels.length, counts: Object.fromEntries(["train", "validation", "test"].map(part => [part, split.rows.filter(row => row.split === part).length])), excluded: split.excluded.length }));
}
