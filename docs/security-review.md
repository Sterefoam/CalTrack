# Pemeriksaan keamanan lokal — 14 November 2026

Pemeriksaan ini mencakup dependensi npm, autentikasi permintaan aplikasi, isolasi
akun, klaim quest dan kapasitas inferensi Luna. Strix telah dicoba melalui konektor
yang dipilih pengguna, tetapi panggilan organisasi dan daftar repositori
mengembalikan `Unknown tool`. Tidak ada pemindaian atau temuan Strix yang diklaim
dalam laporan ini; pemeriksaan berikut dijalankan secara lokal.

## Perbaikan

- Audit npm awal melaporkan 8 kerentanan dependensi: 3 tinggi dan 5 sedang.
  Override memperbarui PostCSS dan esbuild, serta memakai versi sharp yang sama
  dengan dependensi utama. Audit setelah pemasangan melaporkan 0 kerentanan yang
  diketahui pada saat pemeriksaan. Hasil ini bukan jaminan bahwa semua celah
  aplikasi telah ditemukan.
- Permintaan yang mengubah data melalui sesi cookie wajib membawa `Origin` yang
  sama persis dengan URL autentikasi aplikasi. Origin kosong, `null`, berbeda,
  atau `Sec-Fetch-Site: cross-site` ditolak. Klien API berbasis Bearer tetap
  didukung tanpa Origin. Ini penguatan validasi asal permintaan, bukan klaim
  bahwa eksploitasi CSRF sebelumnya telah dibuktikan.
- Luna membatasi inferensi menjadi satu pekerjaan per akun dan dua pekerjaan
  per proses. Kapasitas dikembalikan dalam `finally`, termasuk ketika penyedia
  gagal, dan penutupan lease lama tidak menghapus lease baru. Penolakan memakai
  status 429, pesan yang dapat ditindaklanjuti, dan `Retry-After`.
- Respons browser menambahkan `nosniff`, larangan framing, kebijakan referrer,
  serta CSP terbatas untuk `frame-ancestors`, `base-uri` dan `object-src`.
  Kebijakan ini tidak menetapkan `script-src` dan tidak diklaim sebagai
  perlindungan XSS yang lengkap.
- Quest pilihan memvalidasi tawaran hari ini, kepemilikan akun, dua slot dalam
  transaksi, progres catatan dan XP dari server. Ledger klaim unik mencegah
  penambahan XP berulang. Nilai XP atau identitas yang dikirim klien tidak
  menentukan hadiah.

## Bug yang diperbaiki

Progres quest hasil GET yang terlambat tidak lagi menimpa mutasi yang lebih baru.
Tanggal awal yang belum tersedia menghasilkan daftar quest kosong dengan aman.
Tautan lompat ke konten disembunyikan dengan clipping dan tetap muncul ketika
difokuskan, sehingga tidak terselip di tangkapan halaman panjang. Browser uji
memakai proses tersendiri agar penutupan Edge yang tertahan tidak meninggalkan
proses setelah pengujian.

## Verifikasi

- Build produksi berhasil dan suite berisi 66 tes: 65 lulus, 0 gagal, 1 dilewati.
  Tes yang dilewati adalah worker OCR nyata yang memang memerlukan opt-in.
- `scripts/smoke-security.mjs` lulus 15 pemeriksaan: header browser, autentikasi,
  Origin, manipulasi quest, isolasi percakapan, batas inferensi dan pemulihan
  sesudah kegagalan penyedia. Memakai server model tiruan dan database sementara,
  tanpa menghubungi model nyata atau layanan berbayar.
- `scripts/smoke-backend.mjs` lulus 31 permintaan HTTP, termasuk autentikasi,
  pencatatan, target, favorit, isolasi akun dan pencabutan JWT.
- `scripts/smoke-adventure.mjs` memeriksa animasi XP/level/hadiah, pilihan bersamaan,
  klaim idempoten, persistensi, respons terlambat, reduced motion dan ukuran
  desktop/tablet/mobile. Migrasi database lokal dilakukan setelah cadangan;
  jumlah akun dan catatan makanan tetap sama.
- Migrator drizzle-kit berhasil dijalankan pada database sementara dengan
  esbuild terbaru, dan pembaca gambar Transformers berhasil dengan sharp yang
  disatukan.

## Batas pemeriksaan dan deployment

Gate inferensi tersimpan di memori satu proses. Deployment dengan beberapa
replika memerlukan pembatas bersama pada gateway atau penyimpanan bersama.
Konfigurasikan URL autentikasi sesuai origin publik agar validasi cookie bekerja
di balik reverse proxy. Pemindaian Strix masih perlu dijalankan ketika konektor
tersedia. Pemeriksaan ini tidak mengukur ulang akurasi model makanan atau OCR.

Jalankan setelah build: `node scripts/smoke-security.mjs` dan
`node scripts/smoke-backend.mjs`. Untuk browser, mulai server verifikasi dengan
database sementara lalu jalankan `node scripts/smoke-adventure.mjs` menggunakan
`CALTRACK_TEST_ORIGIN` bila port berbeda dari 32187.
