import { readFile, writeFile } from "node:fs/promises";

const report = JSON.parse(await readFile(new URL("../../.caltrack/ml/v3/report.json", import.meta.url), "utf8"));
if (!report.experimental || report.productionEnabled || !report.test?.samples || report.protocol !== "caltrack-refinement-v3-fresh-test") throw new Error("Expected sealed v3 research report");
const percent = value => `${(value * 100).toFixed(2)}%`;
const compact = value => {
  if (Array.isArray(value)) return value.every(item => item === null || typeof item !== "object") ? JSON.stringify(value) : `[\n${value.map(compact).join(",\n")}\n]`;
  if (value && typeof value === "object") return `{\n${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${compact(item)}`).join(",\n")}\n}`;
  return JSON.stringify(value);
};
await writeFile(new URL("../../docs/food-recognition-ml-v3-report.json", import.meta.url), compact(report) + "\n");
const delta = report.test.top1 - report.frozenV2OnSameFreshTest.top1;
const text = [
  "# Pengenal makanan v3: tambahan foto dan pengujian baru", "",
  "Eksperimen ini menambah 1.061 foto Open Images berlisensi CC BY 2.0. Koleksi lokal menjadi 5.703 foto (1.030 Commons + 4.673 Open Images). Variasi gambar bertambah, sedangkan kosakata tetap 57 kategori agar model lama dan baru bisa dibandingkan langsung. Bobot dan gambar tetap lokal di `.caltrack/ml/`, diabaikan Git dan sinkronisasi. Atribusi setiap foto tersimpan pada manifest kolektor.", "",
  "## Protokol", "",
  "Data latih v2 tetap latih; validasi v2 tetap validasi. Seluruh foto uji v2 dan kelompok duplikatnya dikarantina, termasuk foto yang sebelumnya dikeluarkan. Tidak ada foto dari uji v2 yang dimasukkan ke latihan ini. Duplikat exact/perceptual, hash dan identitas sumber dikelompokkan sebelum pembagian; setiap kelompok hanya boleh berada di satu bagian. Pembagian v3 dibekukan sebelum pelatihan.", "",
  `Setelah penyaringan: ${report.counts.train} latih, ${report.counts.validation} validasi, ${report.counts.test} uji baru. Hanya ${report.testedLabels.length} dari 57 kategori mempunyai cukup foto baru untuk diukur pada uji ini. Kategori lain tetap dapat diprediksi, tetapi tidak punya pengukuran ulang v3.`, "",
  "EfficientNet-B0 dan ConvNeXt-Tiny dilanjutkan dari checkpoint v2 pada resolusi 256 piksel. Augmentasi crop/flip/warna, AdamW, cosine learning rate, label smoothing dan AMP digunakan. Pelatihan dibatasi 12 epoch per arsitektur, dengan penghentian dini. Checkpoint dipilih dari top-1 validasi, macro-F1 sebagai pemecah seri.", "",
  "Pemilihan ensemble mencoba bobot kelipatan 0,25 atas ensemble v2 beku serta kedua hasil fine-tuning. Hanya validasi digunakan untuk pemilihan. Model v2 menggunakan transformasi dan suhu aslinya; model yang dilatih ulang memakai crop 256 piksel. Logits crop tengah dan flip dirata-ratakan. Setelah pemilihan dibekukan, uji baru dibuka sekali; skrip menolak latihan/evaluasi lanjutan pada run yang laporannya sudah disegel.", "",
  "## Hasil pada foto uji baru yang sama", "",
  `Tanggal laporan: ${report.createdAt.slice(0, 10)}.`, "",
  "| Model | Benar | Top-1 | Top-3 | Macro-F1 terukur |", "| --- | ---: | ---: | ---: | ---: |",
  ...[["Ensemble v2 beku", report.frozenV2OnSameFreshTest], ["Pilihan validasi v3", report.test]].map(([name, score]) => `| ${name} | ${score.correct}/${score.samples} | ${percent(score.top1)} | ${percent(score.top3)} | ${score.macroF1.toFixed(4)} |`), "",
  `Selisih top-1: ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(2)} poin persentase. Pasangan prediksi: ${report.pairedDisagreements.improvedOnly} foto membaik dan ${report.pairedDisagreements.regressedOnly} foto memburuk.`,
  `Interval Wilson 95% pilihan v3: ${percent(report.test.wilson95[0])}–${percent(report.test.wilson95[1])}. Bobot [v2 beku, B0 baru, ConvNeXt baru]: ${report.selection.selected.weights.join(" / ")}.`, "",
  "Skor ini tidak sebanding langsung dengan headline 85,64% pada laporan v2: komposisi uji berbeda dan v3 hanya mengukur kategori dengan foto tambahan yang cukup. Pemilihan tidak diubah setelah melihat hasil uji. Selisih kecil bukan bukti peningkatan universal atau jaminan statistik pada semua jenis makanan.", "",
  `Kategori terukur: ${report.testedLabels.join(", ")}.`, "",
  `Belum terukur ulang: ${report.unmeasuredLabels.join(", ")}.`, "",
  "## Menjalankan", "",
  "Gunakan Python dan dependensi GPU dari petunjuk v2. Jalankan dari root proyek:", "",
  "```sh", "python scripts/ml/collect-openimages.py --per-class 240", "node scripts/ml/build-refinement.mjs", "python scripts/ml/train-refinement.py train --run v3 --epochs 12 --batch-size 12 --workers 2", "python scripts/ml/train-refinement.py evaluate --run v3 --batch-size 12 --workers 2", "node scripts/ml/export-refinement-report.mjs", "python scripts/ml/predict-refinement.py /path/to/food.jpg", "```", "",
  "Jangan menimpa pembagian atau laporan uji yang sudah ada. Eksperimen berikutnya memerlukan protokol dan uji baru, tanpa menyesuaikan model terhadap kesalahan pada uji ini. Jalur multiprocessing Windows mendaftarkan modul pelatihan agar DataLoader dapat memuat dataset dengan benar.", "",
  "## Batas penggunaan", "",
  "Ini penelitian offline (`experimental: true`, `productionEnabled: false`). Aplikasi analisis foto tetap menggunakan penyedia vision yang dikonfigurasi; hasil ini tidak otomatis memperbaiki penyedia tersebut. Model masih closed-set dengan skor belum terkalibrasi. Tidak memprediksi gram, kalori atau kandungan gizi. Tidak ada pengukuran pada foto pengguna, makanan di luar kosakata, atau seluruh 57 kategori. Tumpang tindih fotografer/sesi dan data pretraining mungkin tersisa. Akurasi tertinggi universal belum dibuktikan.", "",
  "Lihat [laporan terstruktur](food-recognition-ml-v3-report.json) untuk confusion matrix, dukungan per kelas, parameter dan lingkungan pelatihan.", "",
].join("\n");
await writeFile(new URL("../../docs/food-recognition-ml-v3.md", import.meta.url), text);
console.log(JSON.stringify({ exported: true, test: report.test.top1, baseline: report.frozenV2OnSameFreshTest.top1, testedClasses: report.testedLabels.length }));
