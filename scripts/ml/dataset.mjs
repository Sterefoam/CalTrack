import { hamming, sha256 } from "./core.mjs";

export function duplicateGroups(records) {
  const parents = records.map((_, i) => i);
  const find = i => parents[i] === i ? i : (parents[i] = find(parents[i]));
  const buckets = Array.from({ length: 6 }, () => new Map());
  const hashes = new Map(), sources = new Map();
  records.forEach((row, i) => {
    if (!/^[a-f0-9]{16}$/i.test(row.dhash)) throw new Error("Invalid perceptual hash");
    if (hashes.has(row.sha256)) parents[find(i)] = find(hashes.get(row.sha256));
    hashes.set(row.sha256, i);
    for (const source of [row.sourceImageId, row.sourceImageSha256].filter(Boolean)) {
      if (sources.has(source)) parents[find(i)] = find(sources.get(source));
      sources.set(source, i);
    }
    const candidates = new Set();
    let offset = 0;
    for (let band = 0; band < 6; band++) {
      const bits = band < 4 ? 11 : 10;
      const key = String((BigInt(`0x${row.dhash}`) >> BigInt(offset)) & ((1n << BigInt(bits)) - 1n));
      for (const j of buckets[band].get(key) ?? []) candidates.add(j);
      if (!buckets[band].has(key)) buckets[band].set(key, []);
      buckets[band].get(key).push(i);
      offset += bits;
    }
    // <=5 differing bits must leave at least one of six bands identical.
    for (const j of candidates) if (hamming(row.dhash, records[j].dhash) <= 5) parents[find(i)] = find(j);
  });
  const groups = new Map();
  records.forEach((row, i) => { const key = find(i); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
  return [...groups.values()];
}

/** v1's already-inspected test is retired; every legacy image is train-only in v2. */
export function expansionSplit(records, { legacyIds = [], frozenRows = [], minGroups = 25, minHoldoutGroups = 5 } = {}) {
  const legacy = new Set(legacyIds), frozen = new Map(frozenRows.map(row => [row.id, row.split]));
  const excluded = [], byLabel = new Map();
  for (const group of duplicateGroups(records)) {
    const labels = new Set(group.flatMap(row => [row.label, ...(row.ambiguousLabels ?? [])]));
    const locks = new Set(group.flatMap(row => legacy.has(row.id) ? ["train"] : frozen.has(row.id) ? [frozen.get(row.id)] : []));
    if (labels.size > 1 || locks.size > 1) {
      excluded.push(...group.map(row => ({ id: row.id, reason: labels.size > 1 ? "conflicting_labels" : "conflicting_frozen_splits" })));
      continue;
    }
    const label = group[0].label;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push({ rows: group, lock: [...locks][0], key: sha256(group.map(r => r.id).sort().join("|")) });
  }
  const rows = [], counts = {};
  for (const [label, groups] of [...byLabel].sort(([a], [b]) => a.localeCompare(b))) {
    const fresh = groups.filter(g => !g.lock).sort((a,b) => sha256(`caltrack-v2:${a.key}`).localeCompare(sha256(`caltrack-v2:${b.key}`)));
    const lockedTest = groups.filter(g => g.lock === "test").length;
    const lockedValidation = groups.filter(g => g.lock === "validation").length;
    const desired = Math.max(minHoldoutGroups, Math.min(Math.floor(groups.length * 0.15), Math.floor((fresh.length + lockedTest + lockedValidation) / 2)));
    const testNeed = Math.max(0, desired - lockedTest), valNeed = Math.max(0, desired - lockedValidation);
    if (groups.length < minGroups || fresh.length < testNeed + valNeed + Math.max(0, 5 - groups.filter(g => g.lock === "train").length)) {
      excluded.push(...groups.flatMap(g => g.rows.map(r => ({ id: r.id, reason: "insufficient_fresh_independent_groups" }))));
      continue;
    }
    fresh.forEach((group, i) => { group.lock = i < testNeed ? "test" : i < testNeed + valNeed ? "validation" : "train"; });
    counts[label] = { groups: groups.length, train: 0, validation: 0, test: 0 };
    for (const group of groups) for (const row of group.rows) {
      rows.push({ ...row, split: group.lock, groupId: group.key });
      counts[label][group.lock]++;
    }
  }
  return { protocol: "caltrack-expansion-v2", legacyPolicy: "all-v1-images-train-only; v1-test-retired", rows, counts, excluded };
}

/** Keep prior coverage without inventing evaluation support for legacy-only labels. */
export function expandedDataset(records, options = {}) {
  const split = expansionSplit(records, options);
  const included = new Set(split.rows.map(row => row.id));
  const legacy = new Set(options.legacyIds ?? []), fallback = new Map();
  for (const group of duplicateGroups(records.filter(row => !included.has(row.id)))) {
    const labels = new Set(group.flatMap(row => [row.label, ...(row.ambiguousLabels ?? [])]));
    if (labels.size !== 1 || !group.every(row => legacy.has(row.id))) continue;
    const label = group[0].label;
    if (split.counts[label]) continue;
    if (!fallback.has(label)) fallback.set(label, []);
    fallback.get(label).push(group);
  }
  for (const [label, groups] of fallback) {
    if (groups.length < 12) continue;
    split.counts[label] = { groups: groups.length, train: 0, validation: 0, test: 0, coverage: "legacy-train-only-unmeasured" };
    for (const group of groups) for (const row of group) {
      const groupId = sha256(group.map(row => row.id).sort().join("|"));
      split.rows.push({ ...row, split: "train", groupId });
      split.counts[label].train++;
      included.add(row.id);
    }
  }
  split.excluded = split.excluded.filter(row => !included.has(row.id));
  const heldoutGroups = new Set();
  split.rows = split.rows.sort((a,b) => a.id.localeCompare(b.id)).filter(row => {
    if (row.split === "train") return true;
    if (!heldoutGroups.has(row.groupId)) { heldoutGroups.add(row.groupId); return true; }
    split.counts[row.label][row.split]--;
    split.excluded.push({ id: row.id, reason: "heldout_group_already_represented" });
    return false;
  });
  split.testedLabels = Object.keys(split.counts).filter(label => split.counts[label].test > 0).sort();
  split.unmeasuredLabels = Object.keys(split.counts).filter(label => !split.counts[label].test).sort();
  return split;
}
