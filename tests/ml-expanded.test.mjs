import assert from "node:assert/strict";
import test from "node:test";
import { duplicateGroups, expansionSplit, expandedDataset } from "../scripts/ml/dataset.mjs";
import { sha256 } from "../scripts/ml/core.mjs";
import { sourceClasses } from "../scripts/ml/classes.mjs";

const examples = (label, count) => Array.from({ length: count }, (_, i) => ({ id: `${label}-${i}`, label, sha256: sha256(`${label}-${i}`), dhash: sha256(`image:${label}:${i}`).slice(0, 16) }));
test("expanded classes have unique labels and the duplicate index preserves transitive matches", () => {
  assert.equal(sourceClasses.length, 70);
  assert.equal(new Set(sourceClasses.map(row => row[0])).size, sourceClasses.length);
  const base = examples("rice", 3);
  const groups = duplicateGroups([{ ...base[0], dhash: "0000000000000000" }, { ...base[1], dhash: "000000000000001f" }, { ...base[2], dhash: "00000000000003ff" }]);
  assert.equal(groups.length, 1);
});
test("v2 retires the inspected v1 test and holds out only fresh independent images", () => {
  const records = examples("rice", 50), legacyIds = records.slice(0, 25).map(row => row.id);
  const split = expansionSplit(records, { legacyIds });
  assert.equal(split.rows.length, 50);
  for (const row of split.rows) if (legacyIds.includes(row.id)) assert.equal(row.split, "train");
  assert.ok(split.counts.rice.test >= 5);
  const frozen = expansionSplit([...records, ...examples("soup", 30)], { legacyIds, frozenRows: split.rows });
  for (const row of split.rows) assert.equal(frozen.rows.find(next => next.id === row.id)?.split, row.split);
  assert.deepEqual(expansionSplit(records, { legacyIds }), split);
});
test("ambiguous labels and duplicate groups bridging frozen partitions are excluded", () => {
  const records = examples("rice", 50);
  const split = expansionSplit(records);
  const train = split.rows.find(row => row.split === "train"), heldout = split.rows.find(row => row.split === "test");
  const changed = records.map(row => row.id === train.id ? { ...row, dhash: heldout.dhash } : row);
  const next = expansionSplit(changed, { frozenRows: split.rows });
  assert.ok(next.excluded.some(row => row.id === train.id && row.reason === "conflicting_frozen_splits"));
  const ambiguity = expansionSplit(records.map((row, i) => i === 0 ? { ...row, ambiguousLabels: ["soup"] } : row));
  assert.ok(ambiguity.excluded.some(row => row.id === records[0].id && row.reason === "conflicting_labels"));
});
test("different food crops from the same source photograph cannot cross partitions", () => {
  const rows = examples("rice", 3).map((row, i) => ({ ...row, sourceImageId: i < 2 ? "same-photo" : "other-photo" }));
  const groups = duplicateGroups(rows);
  assert.equal(groups.length, 2);
  assert.ok(groups.some(group => group.length === 2));
  const conflicting = duplicateGroups(rows.map((row, i) => ({ ...row, sourceImageSha256: i > 0 ? "shared-source-hash" : "different" })));
  assert.equal(conflicting.length, 1);
});
test("legacy-only categories retain training coverage without fabricated test support", () => {
  const old = examples("legacy", 20), fresh = examples("new-food", 35);
  const dataset = expandedDataset([...old, ...fresh], { legacyIds: old.map(row => row.id) });
  assert.equal(dataset.rows.length, 55);
  assert.ok(dataset.rows.filter(row => row.label === "legacy").every(row => row.split === "train"));
  assert.deepEqual(dataset.testedLabels, ["new-food"]);
  assert.deepEqual(dataset.unmeasuredLabels, ["legacy"]);
  assert.equal(dataset.counts.legacy.test, 0);
  assert.equal(dataset.counts.legacy.coverage, "legacy-train-only-unmeasured");
  assert.equal(dataset.excluded.length, 0);
});
test("heldout scores count only one representative per near-duplicate group", () => {
  const rows = examples("rice", 40);
  const initial = expandedDataset(rows);
  const target = initial.rows.find(row => row.split === "test");
  const clone = { ...target, id: "duplicate-food-photo", sha256: sha256("new-jpeg-encoding") };
  const expanded = expandedDataset([...rows,clone],{frozenRows:initial.rows});
  const testRows = expanded.rows.filter(row => row.split === "test");
  assert.equal(testRows.length,initial.counts.rice.test);
  assert.equal(new Set(testRows.map(row => row.groupId)).size,testRows.length);
  assert.ok(expanded.excluded.some(row => row.reason === "heldout_group_already_represented"));
});
