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
(favorit, resep contoh, chat, perubahan air/olahraga, dan pengingat) masih memakai
state sesi. Kamera barcode belum membaca kode otomatis dalam mode akun.
Lihat [batas integrasi](docs/frontend-integration.md), [API backend](docs/backend.md),
[resep](docs/recipes.md), dan [pemulihan kata sandi](docs/password-recovery.md).

Eksperimen klasifikasi makanan melatih model dari gambar berlisensi web dan berjalan
offline. Model belum dipasang pada analisis foto produksi. Metode, hasil, serta
keterbatasan tersedia di [laporan awal](docs/food-recognition-ml.md) dan
[pelatihan GPU serta perluasan jenis makanan v2](docs/food-recognition-ml-v2.md).
