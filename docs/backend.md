# Backend CalTrack

Jalankan `npm run db:migrate` sebelum menjalankan server setelah mengambil perubahan skema.
`npm run test` memeriksa service dan migrasi menggunakan database sementara, tanpa mengubah data lokal.

## Autentikasi

Better Auth menangani pendaftaran, hash kata sandi, sesi cookie HttpOnly, login dan logout melalui
`/api/auth/sign-up/email`, `/sign-in/email`, `/get-session`, dan `/sign-out`.
Panjang kata sandi 8–128 karakter. Login dibatasi 5 permintaan per menit per alamat klien.
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

Formulir frontend masih berupa demo sampai task integrasinya dikerjakan.

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
