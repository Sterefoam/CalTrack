# Uji pembaca foto tabel nutrisi lokal

Pembaca lokal tersedia pada `/log/label` setelah memilih bahasa secara eksplisit. Default Deteksi otomatis dengan AI tetap memakai penyedia vision aplikasi. Paket bahasa harus disiapkan di server; pilihan bahasa lokal tidak mengirim foto ke penyedia AI dan tidak mengunduh model saat menerima unggahan. Mode demo tetap memakai data contoh.

## Hasil terukur

Pada 2026-11-13, 20/27 foto label buatan terbaca lengkap, dibanding 14/27 pada pembaca awal. Satu foto hanya lolos jika acuan dan tujuh nilai gizi cocok dengan teks yang dirender. Varian: jelas, diperkecil/diburamkan, dan miring 4 derajat.

| Bahasa yang dipilih | Seluruh angka dan acuan benar |
| --- | ---: |
| Inggris | 3/3 |
| Indonesia | 3/3 |
| Prancis | 3/3 |
| Spanyol | 3/3 |
| Jerman | 3/3 |
| Jepang | 3/3 |
| Arab | 0/3 |
| Mandarin sederhana | 2/3 |
| Hindi | 0/3 |

Label buatan ini dipakai selama pengembangan. Hasil tersebut bukan angka akurasi pada foto kemasan yang belum pernah dilihat dan bukan bukti dukungan semua bahasa.

Uji tambahan memakai 6 foto kemasan publik Open Food Facts dan 2 potongan satu kolom yang diturunkan dari foto tersebut. Dari 3 kasus yang diminta dibaca, 0 terbaca lengkap. Pembacaan sebagian masih memerlukan koreksi. 5/5 kasus foto bagian depan/tabel beberapa kolom ditolak atau dikosongkan sesuai harapan. Penolakan aman dihitung terpisah dari keberhasilan membaca angka.

Foto nyata tersebut meliputi Nutella (Spanyol dan Prancis), Coca-Cola (Inggris dan Jerman), serta Twix (Prancis). Salah satu URL nutrisi ternyata menunjukkan bagian depan Nutella; sumber metadata tidak dianggap sebagai bukti bahwa tabel terlihat. Acuan dan nilai target ditulis dari pemeriksaan visual, bukan diambil dari basis data produk. Semua foto uji nyata, termasuk yang gagal, tetap dilaporkan.

Uji browser tanpa respons tiruan berhasil membaca Inggris, Spanyol, Jepang, Mandarin sederhana dari gambar label buatan melalui endpoint produksi lokal, menghitung 50 g menjadi 120 kkal dan 60 mg natrium, lalu menyimpan ke akun uji sementara. Tampilan 390 dan 1440 piksel diperiksa tanpa gulir horizontal. Foto kemasan nyata belum andal; label Arab dan Hindi masih gagal lengkap.

## Cara kerja dan batas

Tesseract.js 6.0.1 memakai bobot resmi tessdata_best Apache-2.0 yang dipin ke revisi laporan. Versi 7.0.0 tidak digunakan karena jalur relaxed SIMD pada Node 26 gagal dengan model float ini (issue upstream #1080). Tidak ada perubahan pada isi node_modules.

Satu worker membaca foto normal dan varian kontras/ukuran/pelurusan. Rotasi otomatis di atas 10 derajat dibuang. Pembaca menggabungkan nilai kosong hanya jika acuan kedua hasil sama. Konflik angka menjadi kosong; konflik acuan mengosongkan total. Bila hanya satu hasil memiliki acuan jelas, hasil itu dipakai sendiri tanpa menyalin angka dari hasil yang acuannya tidak diketahui. Tabel beberapa acuan dan satuan hilang tidak ditebak. Tidak ada koreksi diam-diam dari huruf O ke angka 0 atau tebakan titik desimal yang hilang.

Parser mempertahankan nol eksplisit dan membedakan nilai tidak diketahui, kurang dari, persen harian, kcal/kJ dan garam/natrium. Dua puluh tujuh gambar ini tidak melatih bobot OCR baru; peningkatan berasal dari persiapan gambar, ekstraksi dan pemeriksaan hasil. Perlu benchmark independen serta pembaca vision terkonfigurasi untuk menilai peningkatan pada kemasan nyata.

Batas: dua proses analisis per proses server, 25 detik, foto maksimal 10 MB/40 juta piksel. Worker dihentikan saat selesai atau batal. Uji integrasi memeriksa pembatalan, kelebihan kapasitas dan pemulihan worker. Hasil tetap wajib dicocokkan oleh pengguna sebelum dihitung/disimpan. Formulir tinjauan menerima desimal seperti protein 2,75 g tanpa memaksa pembulatan satu digit.

## Menjalankan pengujian

```sh
npm run ocr:prepare
npm run ocr:fixtures
npm run ocr:evaluate
node scripts/ocr/real-fixtures.mjs
npx tsx scripts/ocr/evaluate.ts .caltrack/ocr/real/manifest.json .caltrack/ocr/evaluation-real.json
npm run build
node scripts/ocr/smoke.mjs
node scripts/ocr/export-report.mjs
```

Render gambar dan smoke test memakai Edge headless; pilih browser terpasang lain melalui OCR_BROWSER_CHANNEL. Untuk uji worker tambahan, set RUN_LOCAL_OCR_TESTS=1 lalu jalankan tests/local-ocr.test.ts. Seluruh foto, bobot, keluaran dan basis data uji berada dalam `.caltrack/` yang diabaikan Git. Pada deployment, jalankan persiapan bahasa dan sediakan direktori model yang dapat dibaca server; model tidak disertakan dalam bundle browser.

## Sumber dan atribusi

Foto asli Open Food Facts berlisensi CC BY-SA 3.0; potongan mencatat perubahan persegi panjang dan pengodean ulang. [Laporan terstruktur](nutrition-label-ocr-report.json) memuat URL sumber, pembuat, lisensi, hash, hasil per foto dan parameter crop. Gambar tidak dimasukkan ke Git. [Dokumentasi lisensi foto OFF](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorial-uploading-photo-to-a-product/), [model OCR resmi](https://github.com/tesseract-ocr/tessdata_best), dan [issue kompatibilitas Tesseract.js](https://github.com/naptha/tesseract.js/issues/1080).
