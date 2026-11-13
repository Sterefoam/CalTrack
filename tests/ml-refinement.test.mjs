import test from "node:test";
import assert from "node:assert/strict";
import { refinementDataset } from "../scripts/ml/build-refinement.mjs";
import { sha256 } from "../scripts/ml/core.mjs";
const row = (id, split) => ({ id, label: "food", split, sha256: sha256(id), dhash: sha256(`pixels:${id}`).slice(0, 16), file: `images/${id}.jpg` });
test("refinement quarantines the inspected v2 test and source duplicates while preserving prior validation", () => {
  const old = ["train", "validation", "test"].flatMap(part => Array.from({ length: 10 }, (_, i) => row(`${part}-${i}`, part)));
  const fresh = Array.from({ length: 300 }, (_, i) => row(`new-${i}`));
  const retired = old.find(record => record.split === "test");
  retired.sourceImageId = "same-original";
  const duplicate = { ...row("another-encoding"), sourceImageId: "same-original" };
  const previous = { rows: old, counts: { food: {} }, excluded: [] };
  const split = refinementDataset(previous, [...old, ...fresh, duplicate]);
  assert.ok(split.rows.filter(record => record.split === "test").every(record => record.fresh && record.id.startsWith("new-")));
  assert.ok(split.excluded.some(record => record.id === duplicate.id));
  for (const record of old.filter(record => record.split !== "test")) assert.equal(split.rows.find(next => next.id === record.id)?.split, record.split);
  const groups = new Map();
  for (const record of split.rows) { if (groups.has(record.groupId)) assert.equal(groups.get(record.groupId), record.split); groups.set(record.groupId, record.split); }
  assert.deepEqual(refinementDataset(previous, [...old, ...fresh, duplicate]), split);
});
