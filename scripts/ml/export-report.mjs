import { readFile, writeFile } from "node:fs/promises";

const source = new URL("../../.caltrack/ml/v2/report.json", import.meta.url);
const report = JSON.parse(await readFile(source, "utf8"));
if (!report.experimental || report.productionEnabled || !report.test?.samples) throw new Error("Expected a sealed experimental test report");
const percent = value => `${(value * 100).toFixed(2)}%`;
const rows = [
  ["Ensemble terpilih dari validasi",report.test],
  ...report.referenceModels.map(model => [model.checkpoint.replace("-best.pt",""),model.metrics]),
];
const partitions = Object.values(report.counts).reduce((total,row) => {
  for (const part of ["train","validation","test"]) total[part] += row[part];
  return total;
},{train:0,validation:0,test:0});
const summary = [
  `Percobaan GPU pada ${report.createdAt.slice(0,10)}: **${report.classes} kategori dipelajari**,`,
  `dengan **${report.test.measuredClasses} kategori mempunyai dukungan uji baru** dan`,
  `${report.unmeasuredLabels.length} kategori lama belum terukur ulang.`,
  `Koleksi: ${report.collection.total} foto (${report.collection.commons} Commons + ${report.collection.openimages} Open Images).`,
  `Setelah penyaringan: ${report.totalEligible} foto; ${report.excluded} dikeluarkan.`,
  `Pembagian: ${partitions.train} latih, ${partitions.validation} validasi, ${partitions.test} uji.`,
  "",
  "| Model pada holdout v2 yang sama | Top-1 | Top-3 | Macro-F1 terukur |",
  "| --- | ---: | ---: | ---: |",
  ...rows.map(([name,metrics]) => `| ${name} | ${percent(metrics.top1)} | ${percent(metrics.top3)} | ${metrics.macroF1.toFixed(4)} |`),
  "",
  `Hasil utama: ${report.test.correct}/${report.test.samples} prediksi pertama benar.`,
  `Interval Wilson 95% untuk top-1: **${percent(report.test.wilson95[0])}–${percent(report.test.wilson95[1])}**.`,
  `Bobot ensemble: ${report.selection.selected.weights.join(" / ")}; suhu ${report.selection.selected.temperature}.`,
  "Model dipilih sebelum test dibuka; skor model pembanding dilaporkan untuk konteks, bukan untuk mengganti pemenang setelah melihat test.",
  "",
  "Kategori dengan dukungan uji baru:",
  report.testedLabels.join(", ")+".",
  "",
  "Kategori yang dipelajari tetapi belum mempunyai dukungan uji v2:",
  report.unmeasuredLabels.join(", ")+".",
  "",
  "| Kelompok foto uji | Jumlah | Top-1 |",
  "| --- | ---: | ---: |",
  ...Object.entries(report.testSubgroups).map(([name,metrics])=>`| ${name} | ${metrics.samples} | ${percent(metrics.top1)} |`),
  "",
  "Kelompok memiliki komposisi kelas berbeda; selisih antar sumber bukan pengukuran kausal kualitas sumber atau peningkatan pada foto pengguna.",
].join("\n");
function readableJson(value,depth=0) {
  const pad=" ".repeat(depth),inner=" ".repeat(depth+2);
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return value.every(item=>item===null||typeof item!=="object")?JSON.stringify(value):`[\n${value.map(item=>inner+readableJson(item,depth+2)).join(",\n")}\n${pad}]`;
  return `{\n${Object.entries(value).map(([key,item])=>inner+JSON.stringify(key)+": "+readableJson(item,depth+2)).join(",\n")}\n${pad}}`;
}
await writeFile(new URL("../../docs/food-recognition-ml-v2-report.json",import.meta.url),readableJson(report)+"\n");
const guide = new URL("../../docs/food-recognition-ml-v2.md",import.meta.url);
const text = await readFile(guide,"utf8");
if (!text.includes("<!-- results:start -->")) throw new Error("Missing result marker");
await writeFile(guide,text.replace(/<!-- results:start -->[\s\S]*?<!-- results:end -->/,`<!-- results:start -->\n${summary}\n<!-- results:end -->`));
console.log(JSON.stringify({classes:report.classes,testedClasses:report.test.measuredClasses,partitions,test:report.test.top1,exported:true}));
