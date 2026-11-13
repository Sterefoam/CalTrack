# CalTrack

Aplikasi pelacak kalori dan gizi harian dengan Next.js App Router, TypeScript,
Drizzle, SQLite/libSQL, Better Auth, dan daisyUI.

## Menjalankan lokal

Pasang dependensi dengan `npm install`, jalankan migrasi dengan `npm run db:migrate`,
lalu `npm run dev`. Buka http://localhost:3000. Database lokal bawaan menggunakan
`caltrack.db`. Tanpa login, aplikasi menyediakan mode demo dengan data contoh.

Untuk produksi, atur `DATABASE_URL`, `BETTER_AUTH_URL` (origin publik), dan
`BETTER_AUTH_SECRET` acak minimal 32 karakter pada lingkungan server.
`OPENAI_API_KEY` mengaktifkan analisis foto/teks/suara; `OPENAI_MODEL` dan
`OPENAI_TRANSCRIPTION_MODEL` opsional. Pemulihan kata sandi memerlukan
`RESEND_API_KEY` serta `AUTH_EMAIL_FROM` yang telah diverifikasi oleh pengirim email.
Jangan memasukkan kredensial ke Git. Produksi memerlukan penyimpanan database
persisten, bukan filesystem sementara.

## Pemeriksaan

- `npm test`: pengujian service, migrasi, helper klien dan eksperimen ML.
- `npm run build`: build produksi dan pemeriksaan tipe.
- `node scripts/smoke-backend.mjs`: pemeriksaan HTTP setelah build; memakai database
  sementara terpisah, mematikan panggilan AI/email, lalu membersihkan database uji.

## Status fitur

Profil, target, catatan makanan, dan riwayat akun terhubung ke server. Sebagian UI
(favorit, resep contoh, perubahan air/olahraga, dan pengingat) masih memakai
state sesi. Kamera barcode belum membaca kode otomatis dalam mode akun.
Lihat [batas integrasi](docs/frontend-integration.md), [API backend](docs/backend.md),
[resep](docs/recipes.md), dan [pemulihan kata sandi](docs/password-recovery.md).

Luna AI memakai Ollama dengan Qwen3 4B Instruct dan menyimpan percakapan per akun.
Tidak memerlukan API key berbayar; deployment membutuhkan server yang mampu
menjalankan model. Lihat [panduan AI lokal dan deployment](docs/local-chat-deployment.md).
Quest harian memperoleh progres dari catatan makanan, memberi XP satu kali per quest
per hari WIB, dan membuka hadiah kosmetik yang tersimpan di akun. Jalankan migrasi
sebelum memakai fitur quest pada database lama. Tampilan petualangan malam memiliki
navigasi desktop dan ponsel; [arah desain](docs/design-direction.md) mencatat keputusan visual.

Eksperimen klasifikasi makanan melatih model dari gambar berlisensi web dan berjalan
offline. Model belum dipasang pada analisis foto produksi. Metode, hasil, serta
keterbatasan tersedia di [laporan awal](docs/food-recognition-ml.md) dan
[pelatihan GPU serta perluasan jenis makanan v2](docs/food-recognition-ml-v2.md).

Foto makanan sekarang dapat memakai diameter piring atau berat total makanan sebagai
[ukuran pembanding](docs/photo-weight.md). Pembaca [tabel nutrisi berbagai bahasa](docs/nutrition-label.md)
tersedia di `/log/label`; pengguna memeriksa angka, acuan, dan jumlah yang dimakan
sebelum menyimpan. Layanan AI server perlu dikonfigurasi untuk analisis foto nyata.

Model riset [perkiraan berat dalam gram](docs/food-weight-ml.md) dilatih terpisah
dengan 3.262 foto Nutrition5k yang mempunyai berat timbangan. Model klasifikasi dan
berat lokal tetap offline; hasil riset belum membuktikan akurasi pada foto ponsel,
semua hidangan, atau semua bahasa label.
