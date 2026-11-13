import { readFile, writeFile } from "node:fs/promises";
const local = new URL("../../.caltrack/ocr/", import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, local), "utf8"));
const [synthetic, real, manifest, browser, models] = await Promise.all([read("evaluation.json"), read("evaluation-real.json"), read("real/manifest.json"), read("browser-evaluation.json"), read("manifest.json")]);
const summarize = record => {
  const { text, facts, ...publicResult } = record;
  return publicResult;
};
const languages = Object.fromEntries([...new Set(synthetic.records.map(record => record.language))].map(language => {
  const records = synthetic.records.filter(record => record.language === language);
  return [language, { samples: records.length, completeReads: records.filter(record => record.passed).length }];
}));
const photos = real.records.map(record => {
  const source = manifest.records.find(fixture => fixture.id === record.id);
  return { ...summarize(record), outcome: source.outcome, source: source.source, attribution: source.attribution, license: source.license, licenseUrl: source.licenseUrl, sha256: source.sha256, transformation: source.transformation };
});
const report = {
  createdAt: new Date().toISOString(), engine: synthetic.engine, modelRevision: models.revision,
  developmentAcceptanceTest: true, independentAccuracyBenchmark: false, providerVisionTested: false,
  baselineSyntheticCompleteReads: 14, baselineSyntheticSamples: 27,
  synthetic: { samples: synthetic.records.length, completeReads: synthetic.records.filter(record => record.passed).length, languages, records: synthetic.records.map(summarize) },
  realPhotos: {
    originalPhotos: manifest.records.filter(record => !record.transformation).length,
    manuallyCroppedPhotos: manifest.records.filter(record => record.transformation).length,
    singleColumnCases: photos.filter(record => record.outcome === "read-visible-single-column").length,
    completeSingleColumnReads: photos.filter(record => record.outcome === "read-visible-single-column" && record.passed).length,
    rejectionOrAbstentionCases: photos.filter(record => record.outcome !== "read-visible-single-column").length,
    safeRejectionsOrAbstentions: photos.filter(record => record.outcome !== "read-visible-single-column" && record.passed).length,
    records: photos,
  },
  browser,
  limitations: ["Controlled synthetic labels were used during development; their results do not measure unseen real packaging accuracy", "Real photos are a small convenience acceptance set, not an independent representative benchmark", "Arab and Hindi labels did not produce complete reliable reads", "Blur, curved labels, glare and multiple columns remain difficult", "OCR confidence is not calibrated nutrient accuracy; user confirmation remains mandatory", "Main cloud vision path was not tested because no provider key was configured"],
};
await writeFile(new URL("../../docs/nutrition-label-ocr-report.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
const names = { eng: "Inggris", ind: "Indonesia", fra: "Prancis", spa: "Spanyol", deu: "Jerman", jpn: "Jepang", ara: "Arab", chi_sim: "Mandarin sederhana", hin: "Hindi" };
const guide = [
  "# Uji pembaca foto tabel nutrisi lokal", "",
  "Pembaca lokal tersedia pada `/log/label` setelah memilih bahasa secara eksplisit. Default Deteksi otomatis dengan AI tetap memakai penyedia vision aplikasi. Paket bahasa harus disiapkan di server; pilihan bahasa lokal tidak mengirim foto ke penyedia AI dan tidak mengunduh model saat menerima unggahan. Mode demo tetap memakai data contoh.", "",
  "## Hasil terukur", "",
  `Pada ${report.createdAt.slice(0, 10)}, ${report.synthetic.completeReads}/${report.synthetic.samples} foto label buatan terbaca lengkap, dibanding 14/27 pada pembaca awal. Satu foto hanya lolos jika acuan dan tujuh nilai gizi cocok dengan teks yang dirender. Varian: jelas, diperkecil/diburamkan, dan miring 4 derajat.`, "",
  "| Bahasa yang dipilih | Seluruh angka dan acuan benar |", "| --- | ---: |",
  ...Object.entries(languages).map(([language, result]) => `| ${names[language]} | ${result.completeReads}/${result.samples} |`), "",
  "Label buatan ini dipakai selama pengembangan. Hasil tersebut bukan angka akurasi pada foto kemasan yang belum pernah dilihat dan bukan bukti dukungan semua bahasa.", "",
  `Uji tambahan memakai ${report.realPhotos.originalPhotos} foto kemasan publik Open Food Facts dan ${report.realPhotos.manuallyCroppedPhotos} potongan satu kolom yang diturunkan dari foto tersebut. Dari ${report.realPhotos.singleColumnCases} kasus yang diminta dibaca, ${report.realPhotos.completeSingleColumnReads} terbaca lengkap. Pembacaan sebagian masih memerlukan koreksi. ${report.realPhotos.safeRejectionsOrAbstentions}/${report.realPhotos.rejectionOrAbstentionCases} kasus foto bagian depan/tabel beberapa kolom ditolak atau dikosongkan sesuai harapan. Penolakan aman dihitung terpisah dari keberhasilan membaca angka.`, "",
  "Foto nyata tersebut meliputi Nutella (Spanyol dan Prancis), Coca-Cola (Inggris dan Jerman), serta Twix (Prancis). Salah satu URL nutrisi ternyata menunjukkan bagian depan Nutella; sumber metadata tidak dianggap sebagai bukti bahwa tabel terlihat. Acuan dan nilai target ditulis dari pemeriksaan visual, bukan diambil dari basis data produk. Semua foto uji nyata, termasuk yang gagal, tetap dilaporkan.", "",
  `Uji browser tanpa respons tiruan berhasil membaca ${browser.languages.map(item => names[item.language]).join(", ")} dari gambar label buatan melalui endpoint produksi lokal, menghitung 50 g menjadi 120 kkal dan 60 mg natrium, lalu menyimpan ke akun uji sementara. Tampilan 390 dan 1440 piksel diperiksa tanpa gulir horizontal. Foto kemasan nyata belum andal; label Arab dan Hindi masih gagal lengkap.`, "",
  "## Cara kerja dan batas", "",
  "Tesseract.js 6.0.1 memakai bobot resmi tessdata_best Apache-2.0 yang dipin ke revisi laporan. Versi 7.0.0 tidak digunakan karena jalur relaxed SIMD pada Node 26 gagal dengan model float ini (issue upstream #1080). Tidak ada perubahan pada isi node_modules.", "",
  "Satu worker membaca foto normal dan varian kontras/ukuran/pelurusan. Rotasi otomatis di atas 10 derajat dibuang. Pembaca menggabungkan nilai kosong hanya jika acuan kedua hasil sama. Konflik angka menjadi kosong; konflik acuan mengosongkan total. Bila hanya satu hasil memiliki acuan jelas, hasil itu dipakai sendiri tanpa menyalin angka dari hasil yang acuannya tidak diketahui. Tabel beberapa acuan dan satuan hilang tidak ditebak. Tidak ada koreksi diam-diam dari huruf O ke angka 0 atau tebakan titik desimal yang hilang.", "",
  "Parser mempertahankan nol eksplisit dan membedakan nilai tidak diketahui, kurang dari, persen harian, kcal/kJ dan garam/natrium. Dua puluh tujuh gambar ini tidak melatih bobot OCR baru; peningkatan berasal dari persiapan gambar, ekstraksi dan pemeriksaan hasil. Perlu benchmark independen serta pembaca vision terkonfigurasi untuk menilai peningkatan pada kemasan nyata.", "",
  "Batas: dua proses analisis per proses server, 25 detik, foto maksimal 10 MB/40 juta piksel. Worker dihentikan saat selesai atau batal. Uji integrasi memeriksa pembatalan, kelebihan kapasitas dan pemulihan worker. Hasil tetap wajib dicocokkan oleh pengguna sebelum dihitung/disimpan. Formulir tinjauan menerima desimal seperti protein 2,75 g tanpa memaksa pembulatan satu digit.", "",
  "## Menjalankan pengujian", "",
  "```sh", "npm run ocr:prepare", "npm run ocr:fixtures", "npm run ocr:evaluate", "node scripts/ocr/real-fixtures.mjs", "npx tsx scripts/ocr/evaluate.ts .caltrack/ocr/real/manifest.json .caltrack/ocr/evaluation-real.json", "npm run build", "node scripts/ocr/smoke.mjs", "node scripts/ocr/export-report.mjs", "```", "",
  "Render gambar dan smoke test memakai Edge headless; pilih browser terpasang lain melalui OCR_BROWSER_CHANNEL. Untuk uji worker tambahan, set RUN_LOCAL_OCR_TESTS=1 lalu jalankan tests/local-ocr.test.ts. Seluruh foto, bobot, keluaran dan basis data uji berada dalam `.caltrack/` yang diabaikan Git. Pada deployment, jalankan persiapan bahasa dan sediakan direktori model yang dapat dibaca server; model tidak disertakan dalam bundle browser.", "",
  "## Sumber dan atribusi", "",
  "Foto asli Open Food Facts berlisensi CC BY-SA 3.0; potongan mencatat perubahan persegi panjang dan pengodean ulang. [Laporan terstruktur](nutrition-label-ocr-report.json) memuat URL sumber, pembuat, lisensi, hash, hasil per foto dan parameter crop. Gambar tidak dimasukkan ke Git. [Dokumentasi lisensi foto OFF](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorial-uploading-photo-to-a-product/), [model OCR resmi](https://github.com/tesseract-ocr/tessdata_best), dan [issue kompatibilitas Tesseract.js](https://github.com/naptha/tesseract.js/issues/1080).", "",
].join("\n");
await writeFile(new URL("../../docs/nutrition-label-ocr.md", import.meta.url), guide);
console.log(JSON.stringify({ syntheticComplete: report.synthetic.completeReads, syntheticSamples: report.synthetic.samples, realCompleteReads: report.realPhotos.completeSingleColumnReads, realPositiveCases: report.realPhotos.singleColumnCases, exported: true }));
