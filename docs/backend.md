# Backend CalTrack

Jalankan `npm run db:migrate` sebelum menjalankan server setelah mengambil perubahan skema.
`npm run test` memeriksa service dan migrasi menggunakan database sementara, tanpa mengubah data lokal.

## Autentikasi

Better Auth menangani pendaftaran, hash kata sandi, sesi cookie HttpOnly, login dan logout melalui
`/api/auth/sign-up/email`, `/sign-in/email`, `/get-session`, dan `/sign-out`.
Panjang kata sandi 8–128 karakter. Login dibatasi 5 permintaan per menit. Better Auth memakai
alamat klien bila runtime menyediakan IP tepercaya; tanpa IP, bucket per-path dipakai bersama.
Atur trusted proxy/IP sesuai deployment sebelum produksi; jangan mempercayai header IP bebas.
Hash kredensial baru tersimpan di `accounts.password`; kolom lama `users.password_hash` dipertahankan
untuk kompatibilitas dan tidak dikembalikan dalam respons.

Konfigurasikan `BETTER_AUTH_URL` dengan origin aplikasi dan `BETTER_AUTH_SECRET` acak minimal
32 karakter pada lingkungan server. Pada produksi, gunakan HTTPS; konfigurasi yang belum lengkap
menghasilkan 503 `auth_not_configured`. Untuk pengembangan, origin bawaan `http://localhost:3000`
dan secret lokal dibuat otomatis di `.caltrack/auth-secret` yang diabaikan Git. Secret ini
dipertahankan setelah restart agar kunci JWT tersimpan tetap dapat digunakan.
Jangan mengirim secret ke browser atau memasukkannya ke repository.

Pengguna bersesi dapat meminta JWT melalui `GET /api/auth/token`; kunci publik tersedia melalui
`GET /api/auth/jwks`. JWT berlaku 15 menit dan hanya memuat ID pengguna serta ID sesi.
API memverifikasi signature EdDSA, issuer, audience, kedaluwarsa, dan sesi aktif sehingga logout
juga membatalkan akses JWT. Semua API data memakai `requireUser`; parameter `userId` tidak
menentukan identitas pengguna. Mutasi dengan cookie menolak Origin asing.

Formulir frontend memakai endpoint email untuk akun. Tanpa sesi pengguna, aplikasi menawarkan
mode demo; kegagalan bootstrap akun ditampilkan dengan opsi coba lagi dan pilihan demo eksplisit.

## Profil dan target

`GET /api/profile` membaca profil pengguna yang sedang login; `PUT /api/profile` menerima
`name`, `age`, `gender`, `weightKg`, `heightCm`, `activityLevel`, dan `goal`.
Profil untuk dewasa mengikuti batas formulir: usia 18–100 tahun, berat 30–300 kg,
tinggi 120–230 cm. Nilai BMR/TDEE dari klien tidak digunakan.
Mifflin-St Jeor: `10×kg + 6,25×cm − 5×usia + (5 pria / −161 wanita)`.
Faktor aktivitas: 1,2 / 1,375 / 1,55 / 1,725 / 1,9. Maintenance memakai TDEE,
weight loss memakai 85%, weight gain 110%, dibulatkan ke kkal terdekat.
Protein 1,6 g/kg, lemak 25% kalori, sisanya karbohidrat. Profil dan target baru disimpan
dalam satu transaksi; target lama dipertahankan sebagai riwayat `effective_from`.

## Analisis foto

Catatan final dikirim ke `POST /api/food-logs`: `mealType`, `inputMethod`, `items` (1–20),
opsional `imageUrl`, `confidenceScore`, `notes`, dan `loggedAt` dengan zona waktu.
Item memakai nama camelCase seperti `foodName`, `weightGrams`, `proteinG`, dan `sodiumMg`.
Server menghitung total dari item akhir yang telah diedit; penyimpanan log dan semua item satu transaksi.
Respons 201 berisi ID catatan dan total. API hanya menulis catatan untuk sesi pengguna sendiri.

`POST /api/analyze/photo` menerima multipart dengan satu file `photo` (JPG/PNG/WebP, maksimal
10 MB dan 40 juta piksel). Foto divalidasi dari isi, diputar sesuai orientasi, diubah maksimal
1600px, dan di-encode ulang tanpa EXIF/GPS. Foto diproses di memori; endpoint ini tidak
menyimpan foto atau catatan makanan. Hasil berisi `items`, `confidenceScore`, dan
`requiresConfirmation: true` untuk editor.

Konfigurasikan `OPENAI_API_KEY` di server. `OPENAI_MODEL` opsional, bawaan `gpt-4o` sesuai PRD.
Pemanggilan OpenAI memakai Structured Outputs dan `store: false`, dengan timeout 9 detik.
Uji otomatis mengganti transport provider; tidak mengirim foto pengguna atau membuat panggilan berbayar.
Tanpa konfigurasi provider endpoint mengembalikan 503 `ai_not_configured`.
Foto yang tidak berisi makanan mengembalikan 422 `no_food_detected`; kegagalan provider tidak
menyimpan log. Analisis dibatasi 10 permintaan per menit per pengguna pada satu proses server.

## Katalog dan porsi

`GET /api/foods?q=...&limit=20` mencari nama atau merek pada katalog lokal, dengan query
2–120 karakter dan limit 1–50. Katalog awal dapat kosong; respons tetap `{foods: []}`.
`GET /api/foods/barcode/[code]` menerima barcode 8 atau 12–14 digit, mencari cache lokal,
lalu Open Food Facts bila perlu. Respons `found`, `not_found`, atau `incomplete` membedakan
produk lengkap dari produk yang belum memiliki semua nutrisi. Nilai tidak diketahui berupa
`null`; hanya produk lengkap yang dicache. Sodium dikonversi dari gram ke mg dan energi kJ
ke kkal. Konfigurasikan `OPENFOODFACTS_USER_AGENT` untuk identitas aplikasi pada produksi.
Timeout/kegagalan provider menghasilkan 503 `food_provider_unavailable`; JSON rusak
menghasilkan 502 `invalid_food_provider_response`. Respons error menyertakan
`fallback: "manual"` dan `retryable` untuk menawarkan input label kemasan atau coba lagi.
Cache lokal tetap tersedia saat provider mati. Fallback tidak membuat nilai gizi rekaan.

Untuk mencatat porsi katalog, kirim `items: [{foodId, weightGrams}]` ke `POST /api/food-logs`.
Server menghitung seluruh nutrisi per 100 gram; nilai gizi klien untuk referensi katalog
diabaikan. Item manual tetap menerima nilai gizi lengkap yang sudah dikonfirmasi pengguna.
Referensi `foodId` dan snapshot gizi disimpan bersama. Penghapusan produk katalog tidak
menghapus nilai gizi riwayat. PATCH menerima format item yang sama; porsi 0,1–10.000 gram.

## Favorit

`POST /api/favorites` menerima `inputMethod` dan `items` (1–20) dalam format item log.
Item katalog memakai `foodId`/`weightGrams`; item manual memakai seluruh nilai gizi.
Favorit dan komponen berurutan disimpan dalam satu transaksi. `GET /api/favorites`
menerima `q` opsional, `limit` 1–50 dan `cursor`; respons berisi `favorites` dan
`nextCursor`. `DELETE /api/favorites/[id]` menghapus favorit beserta komponennya.
Semua operasi dibatasi pengguna yang login; ID milik orang lain mengembalikan 404.
Menyimpan favorit tidak menambah konsumsi harian; pengguna tetap meninjau porsi sebelum log.

## Teks, suara, dan chat

`POST /api/analyze/text` menerima `{text}` (3–1.000 karakter), memakai kontrak hasil analisis
foto yang sama dan tidak langsung menyimpan log. `POST /api/analyze/voice` menerima file
multipart `audio` maksimal 10 MB dengan container WebM, WAV, MP3, MP4/M4A yang cocok
dengan MIME-nya. Transkripsi bahasa Indonesia memakai `whisper-1` atau
`OPENAI_TRANSCRIPTION_MODEL`, lalu diparsing menjadi nutrisi. Respons suara juga berisi
`transcript`. Ogg belum didukung. Timeout transkripsi 15 detik dan analisis gizi 9 detik.

`GET /api/chat` mengembalikan percakapan sendiri; `?conversationId=...` membaca pesannya.
`POST /api/chat` menerima `message` (1–500 karakter), `conversationId` opsional dan
`timeZone` IANA opsional. Konteks sisa kalori, protein dan air dihitung dari database server.
Model menerima maksimal 10 pesan terakhir. Satu percakapan dibatasi 20 pasangan pesan.
Pasangan pesan disimpan atomik hanya setelah provider berhasil; kegagalan tidak membuat
percakapan kosong. Percakapan pengguna lain tidak dapat dibaca atau dilanjutkan.

## Riwayat dan dashboard

Unggah data JSON catatan yang sudah ditinjau melalui `POST /api/food-logs` dengan
`mealType`, `inputMethod`, `items`, dan opsional `loggedAt`, `notes`,
`confidenceScore`, `imageUrl`. Body dibatasi 100.000 byte dan 1–20 komponen;
setiap komponen manual memerlukan berat, kalori, makro, serat, gula dan sodium.
Hasil 201 berisi ID, komponen dan total yang dihitung server. Identitas maupun
total kiriman klien tidak dipercaya. Objek bebas `rawAiResponse` tidak disimpan;
snapshot terstruktur final menjadi sumber data riwayat. Foto/audio mentah dikirim
ke endpoint analisis, bukan disisipkan sebagai JSON/base64 pada endpoint log.

`GET /api/food-logs` menerima `date` YYYY-MM-DD, `timeZone` (bawaan Asia/Jakarta),
`mealType`, `q`, `limit` 1–50 dan `cursor`. Respons berisi `logs`, `summary` dari seluruh
hasil filter hari itu, dan `nextCursor`. `GET/PATCH/DELETE /api/food-logs/[id]` hanya dapat
mengakses log sendiri; ID asing mengembalikan 404. PATCH mempertahankan waktu log bila
tidak dikirim dan mengganti item secara atomik. DELETE juga menghapus item log.
Dashboard harian menghitung ulang konsumsi, makro dan sisa kalori dari data yang tersimpan,
memakai target historis yang berlaku pada tanggal tersebut.

## Profil dan target

`calculateTargets` di `lib/nutrition/profile.ts` menggunakan Mifflin–St Jeor:
10 × berat kg + 6,25 × tinggi cm − 5 × usia, ditambah 5 untuk laki-laki atau
dikurangi 161 untuk perempuan. TDEE mengalikan BMR dengan faktor aktivitas
1,2 / 1,375 / 1,55 / 1,725 / 1,9. Tujuan turun berat memakai 85% TDEE,
menjaga berat 100%, dan naik berat 110%, dibulatkan ke kkal terdekat. Protein
1,6 g/kg, lemak 25% kalori, dan karbohidrat memakai sisa energi dengan batas
bawah nol. Ini estimasi untuk profil dewasa, bukan penilaian medis individual.
Pratinjau frontend dan penyimpanan backend menggunakan fungsi yang sama.

`GET /api/profile` membaca profil dan target terbaru; belum ada profil menghasilkan
`null`. `PUT /api/profile` membuat atau memperbarui profil fisik sekaligus menghitung
target BMR/TDEE di server dan menyimpan versi target baru dalam satu transaksi.
`DELETE /api/profile` menghapus profil fisik beserta seluruh versi target akun sendiri
secara atomik dan idempoten (204). Akun, nama tampilan, serta catatan makanan tetap
tersedia; pengguna perlu mengisi onboarding lagi sebelum memiliki target. Riwayat
target yang dihapus tidak lagi digunakan pada ringkasan hari lama. Identitas selalu
berasal dari sesi/JWT; `userId` kiriman klien tidak digunakan.

## Verifikasi backend

`npm test` menjalankan pengujian service dengan SQLite sementara dan transport provider
tiruan. `npm run build` memeriksa build produksi. Setelah build, jalankan
`node scripts/smoke-backend.mjs` untuk 31 permintaan HTTP terhadap server sementara
di 127.0.0.1:3101 (`SMOKE_PORT` dapat diganti). Skrip memakai database uji terpisah,
secret auth acak, serta mematikan API AI; database uji dihapus setelah server berhenti.
Uji ini mencakup registrasi, profil, JWT, porsi katalog, riwayat/edit/hapus, dashboard,
favorit, isolasi dua akun dan pembatalan sesi setelah logout.

Verifikasi akhir plan: 36 tes service/migrasi/ML/helper klien lulus, build produksi lulus dan
31 permintaan smoke HTTP lulus, termasuk pemulihan tanpa pengirim dan penghapusan profil.
Provider OpenAI/Open Food Facts diuji lewat transport
tiruan; panggilan live belum diverifikasi. Integrasi UI akun dan batas fitur yang masih
berlaku selama sesi dijelaskan di [frontend-integration.md](./frontend-integration.md).
