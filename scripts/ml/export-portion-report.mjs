import { readFile, writeFile } from "node:fs/promises";
const report = JSON.parse(await readFile(new URL("../../.caltrack/ml/portion/mass-v1/report.json", import.meta.url), "utf8"));
if (!report.experimental || report.productionEnabled || !report.test?.samples || report.selection?.testAccessed !== false) throw new Error("Expected a sealed offline mass experiment selected before test");
await writeFile(new URL("../../docs/food-weight-ml-report.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
const grams = value => value.toFixed(2), percent = value => `${(value * 100).toFixed(2)}%`;
const text = `# Perkiraan berat makanan dengan machine learning

Percobaan offline GPU pada ${report.createdAt.slice(0, 10)}, menggunakan **${Object.values(report.counts).reduce((sum, value) => sum + value, 0)} foto Nutrition5k** dengan anotasi berat total makanan hasil timbangan. Ini adalah regresi gram, bukan akurasi pengenalan jenis makanan.

| Pembagian | Foto |
| --- | ---: |
${Object.entries(report.counts).map(([name, count]) => `| ${name} | ${count} |`).join("\n")}

| Hasil pada uji resmi yang disegel | Model terpilih | Tebakan median data latih |
| --- | ---: | ---: |
| Rata-rata kesalahan absolut | ${grams(report.test.maeGrams)} g | ${grams(report.trainingMedianTest.maeGrams)} g |
| Median kesalahan absolut | ${grams(report.test.medianAbsoluteErrorGrams)} g | ${grams(report.trainingMedianTest.medianAbsoluteErrorGrams)} g |
| RMSE | ${grams(report.test.rmseGrams)} g | ${grams(report.trainingMedianTest.rmseGrams)} g |
| MAPE | ${percent(report.test.mape)} | ${percent(report.trainingMedianTest.mape)} |
| Dalam toleransi 20% berat asli | ${percent(report.test.within20Percent)} | ${percent(report.trainingMedianTest.within20Percent)} |
| Dalam selisih 50 g | ${percent(report.test.within50Grams)} | ${percent(report.trainingMedianTest.within50Grams)} |

Model dipilih berdasarkan MAE validasi: **${report.selection.selected.kind}**, ${grams(report.selection.selected.validation.maeGrams)} g. Kandidat meliputi median data latih, EfficientNet-B0 beku dengan regresi ridge log-mass, dan fine-tuning EfficientNet-B0. Checkpoint dan kandidat dipilih sebelum membuka uji. Tidak ada penyesuaian memakai hasil uji.

Kalibrasi memakai ${report.selection.interval.samples} foto pada hari pengambilan yang terpisah dari latih/validasi. Rentang split-conformal menargetkan 90% cakupan pada domain sejenis; radius ${grams(report.selection.interval.radiusGrams)} g. Cakupan uji aktual **${percent(report.intervalTest.empiricalCoverage)}**, lebar rata-rata ${grams(report.intervalTest.meanWidthGrams)} g. Ini bukan jaminan untuk foto di luar domain. Foto uji yang berdekatan dapat berkorelasi.

## Sumber dan pencegahan kebocoran

- [Nutrition5k, Quin Thames et al., CVPR 2021](https://github.com/google-research-datasets/Nutrition5k), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Atribusi, URL asli, dan perubahan ukuran/format disimpan dalam manifest lokal.
- Memakai overhead RGB dan berat total hidangan yang dapat dimakan, tanpa video atau depth. ${report.excluded} duplikat/konflik dikeluarkan. Tiga unduhan gagal dari 3.265 ID overhead resmi; tidak diganti dengan contoh buatan.
- Pembagian test resmi dipertahankan; data latih resmi dibagi lagi menurut hari pengambilan UTC untuk validasi dan kalibrasi. Uji hash/fingerprint mencegah foto yang sama melintasi pembagian.
- Seluruh piring dipertahankan saat resize; tidak memakai random crop yang dapat mengubah luas makanan tanpa mengubah label gram.

## Batas penerapan

**Masih eksperimental dan belum diaktifkan sebagai model produksi aplikasi.** Rig kamera, ukuran piring, dan menu kantin pada dataset berbeda dari foto telepon pengguna. Hidangan Indonesia, skala piring bervariasi, makanan tersembunyi, dan kondisi cahaya baru belum tervalidasi. Hasil ini tidak membuktikan berat pasti dari satu foto. Protokol RGB/hari pengambilan ini berbeda dari eksperimen video/depth pada makalah asli.

Aplikasi memakai layanan vision yang dikonfigurasi dan ukuran pembanding pengguna; implementasinya dijelaskan di [photo-weight.md](photo-weight.md). Belum ada uji timbangan yang membandingkan layanan aplikasi dengan model riset ini. Hasil klasifikasi 57 kategori juga berasal dari dataset dan tujuan berbeda.

## Menjalankan ulang

Dependensi lokal riset sama dengan eksperimen pengenal makanan di [food-recognition-ml-v2.md](food-recognition-ml-v2.md).

\`\`\`text
node scripts/ml/collect-portion.mjs
python scripts/ml/train-portion.py train --run mass-v1 --epochs 30
python scripts/ml/train-portion.py evaluate --run mass-v1
python scripts/ml/predict-portion.py PATH_FOTO --run mass-v1
node scripts/ml/export-portion-report.mjs
\`\`\`

Tahap evaluate hanya dijalankan sekali dan menolak menimpa laporan yang sudah disegel. Untuk penelitian baru, gunakan kumpulan uji baru yang belum dipakai memilih model. Foto, paket Python, checkpoint, dan cache berada di .caltrack/ yang diabaikan Git; GitHub berisi alat, protokol, dan laporan terukur.
`;
await writeFile(new URL("../../docs/food-weight-ml.md", import.meta.url), text);
console.log(JSON.stringify({ exported: true, samples: report.test.samples, maeGrams: report.test.maeGrams }));
