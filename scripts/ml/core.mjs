import { createHash } from "node:crypto";

import { sourceClasses as expandedSourceClasses } from "./classes.mjs";
// Keep the original collector's v1 category inventory reproducible.
export const sourceClasses = expandedSourceClasses.slice(0, 25);
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const plainText = value => String(value ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
export function acceptedLicense(metadata) {
  const name = metadata.LicenseShortName?.value ?? "";
  const url = metadata.LicenseUrl?.value ?? "";
  const publicDomain = /^(?:CC0|Public domain)$/i.test(name);
  const cc = /^CC BY(?:-SA)? (?:1\.0|2\.0|2\.5|3\.0|4\.0)$/i.test(name);
  if (!(publicDomain || cc) || (cc && !/^https?:\/\/creativecommons\.org\/licenses\/(?:by|by-sa)\//.test(url))) return null;
  const author = plainText(metadata.Artist?.value);
  if (!author) return null;
  return { name, url: url || "https://creativecommons.org/publicdomain/mark/1.0/", author };
}
export function allowedImageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname)) throw new Error("Unexpected image host");
  return url.href;
}
export function normalize(vector) {
  const norm = Math.hypot(...vector);
  if (!norm || !Number.isFinite(norm) || vector.some(value => !Number.isFinite(value))) throw new Error("Invalid embedding");
  return Array.from(vector, value => value / norm);
}
export function hamming(a, b) {
  let value = BigInt("0x" + a) ^ BigInt("0x" + b), count = 0;
  while (value) { value &= value - 1n; count++; }
  return count;
}
// Connect all near-duplicates before splitting, including transitive matches.
export function splitDataset(records, minGroups = 12) {
  const parents = records.map((_, index) => index);
  const find = i => parents[i] === i ? i : (parents[i] = find(parents[i]));
  for (let i = 0; i < records.length; i++) for (let j = 0; j < i; j++) {
    if (records[i].sha256 === records[j].sha256 || hamming(records[i].dhash, records[j].dhash) <= 5) parents[find(i)] = find(j);
  }
  const groups = new Map();
  records.forEach((record, i) => { const key = find(i); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); });
  const byLabel = new Map(), excluded = [];
  for (const group of groups.values()) {
    if (new Set(group.map(r => r.label)).size !== 1) { excluded.push(...group.map(r => ({ id: r.id, reason: "conflicting_near_duplicate_labels" }))); continue; }
    const label = group[0].label;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(group);
  }
  const rows = [], counts = {};
  for (const [label, labelGroups] of byLabel) {
    if (labelGroups.length < minGroups) { excluded.push(...labelGroups.flat().map(r => ({ id: r.id, reason: "insufficient_independent_images" }))); continue; }
    labelGroups.sort((a,b) => sha256("caltrack-split-v1:" + a[0].id).localeCompare(sha256("caltrack-split-v1:" + b[0].id)));
    const heldOut = Math.max(2, Math.floor(labelGroups.length * 0.15));
    counts[label] = { groups: labelGroups.length, train: 0, validation: 0, test: 0 };
    labelGroups.forEach((group, i) => {
      const split = i < heldOut ? "test" : i < heldOut * 2 ? "validation" : "train";
      const groupId = sha256(group.map(r => r.id).sort().join("|"));
      for (const record of group) { rows.push({ ...record, split, groupId }); counts[label][split]++; }
    });
  }
  return { rows, counts, excluded };
}
export function rank(vector, model) {
  const features = normalize(vector);
  return model.labels.map((label, i) => ({ label, score: model.weights[i].reduce((sum, weight, j) => sum + weight * features[j], model.bias?.[i] ?? 0) })).sort((a,b) => b.score - a.score);
}
export function metrics(rows, model) {
  const confusion = model.labels.map(() => model.labels.map(() => 0));
  let correct = 0, top3 = 0;
  for (const row of rows) {
    const ranked = rank(row.vector, model);
    const truth = model.labels.indexOf(row.label), predicted = model.labels.indexOf(ranked[0].label);
    confusion[truth][predicted]++; correct += truth === predicted ? 1 : 0;
    top3 += ranked.slice(0,3).some(r => r.label === row.label) ? 1 : 0;
  }
  const perClass = model.labels.map((label, i) => {
    const tp = confusion[i][i], support = confusion[i].reduce((a,b) => a+b,0), predicted = confusion.reduce((sum,row) => sum+row[i],0);
    const precision = predicted ? tp/predicted : 0, recall = support ? tp/support : 0;
    return { label, support, precision, recall, f1: precision+recall ? 2*precision*recall/(precision+recall) : 0 };
  });
  return { samples: rows.length, top1: rows.length ? correct/rows.length : 0, top3: rows.length ? top3/rows.length : 0, macroF1: perClass.reduce((sum,r)=>sum+r.f1,0)/model.labels.length, perClass, confusion };
}
export function trainCentroids(rows, labels) {
  const weights = labels.map(label => {
    const examples = rows.filter(r => r.label === label);
    return normalize(examples[0].vector.map((_,j) => examples.reduce((sum,r)=>sum+r.vector[j],0)/examples.length));
  });
  return { kind: "nearest-centroid", labels, weights };
}
export function trainLinear(rows, labels, { regularization = 0.001, epochs = 100 } = {}) {
  const dim = rows[0].vector.length;
  const weights = labels.map(()=>Array(dim).fill(0)), bias = labels.map(()=>0);
  const frequencies = labels.map(label => rows.filter(row=>row.label===label).length);
  for (let epoch=0; epoch<epochs; epoch++) {
    const gradient = labels.map(()=>Array(dim).fill(0)), biasGradient = labels.map(()=>0);
    for (const row of rows) {
      const truth = labels.indexOf(row.label), balance = rows.length/(labels.length*frequencies[truth]);
      const logits = weights.map((w,i)=>w.reduce((sum,value,j)=>sum+value*row.vector[j],bias[i]));
      const max = Math.max(...logits), exp = logits.map(v=>Math.exp(v-max)), sum = exp.reduce((a,b)=>a+b,0);
      for (let i=0;i<labels.length;i++) {
        const error = (exp[i]/sum - (i===truth ? 1 : 0))*balance/rows.length;
        biasGradient[i] += error;
        for (let j=0;j<dim;j++) gradient[i][j] += error*row.vector[j];
      }
    }
    const rate = 5/Math.sqrt(1+epoch/20);
    for (let i=0;i<labels.length;i++) {
      bias[i] -= rate*biasGradient[i];
      for (let j=0;j<dim;j++) weights[i][j] -= rate*(gradient[i][j]+regularization*weights[i][j]);
    }
  }
  return { kind: "balanced-linear-softmax", labels, weights, bias, regularization, epochs };
}
