# Pemulihan kata sandi

Halaman `/forgot-password` dapat dibuka dari layar masuk. Better Auth menyediakan
`POST /api/auth/request-password-reset` dan `POST /api/auth/reset-password`.
Tautan email mengarah ke callback Better Auth lalu `/reset-password`; origin redirect
divalidasi. Halaman menghapus token dari URL setelah membacanya dan memakai
`Referrer-Policy: no-referrer`. Token tidak disimpan ke browser storage.

Atur `RESEND_API_KEY` dan `AUTH_EMAIL_FROM` (alamat pengirim yang sudah diverifikasi
di Resend) pada lingkungan server. Tanpa keduanya, permintaan pemulihan mengembalikan
503 `password_reset_unavailable` untuk semua alamat. Jangan menaruh kunci di kode
atau konfigurasi publik. Pengiriman memakai teks biasa, timeout 10 detik, dan
berjalan setelah respons melalui Next.js `after`. Respons umum tidak membedakan
email terdaftar dan tidak terdaftar. Kegagalan pengiriman mencatat kode tetap tanpa
alamat, token, atau isi respons provider. Belum ada retry email otomatis; pengguna
dapat meminta tautan baru bila email tidak sampai.

Token berlaku 15 menit dan dikonsumsi sekali. Perubahan kata sandi, konsumsi token,
dan pencabutan seluruh sesi berlangsung dalam transaksi adapter Drizzle. JWT lama
ikut ditolak karena autentikasi memeriksa sesi yang masih aktif. Kata sandi baru
harus 8–128 karakter. Permintaan tautan dibatasi 3 per menit dan penggantian kata
sandi 5 per menit; pembatas bawaan berada di memori proses. Untuk beberapa replika,
gunakan penyimpanan pembatas bersama dan konfigurasikan IP proxy tepercaya.

`tests/password-recovery.test.ts` menguji respons umum, pengiriman tiruan, masa
berlaku, token salah/terpakai/kedaluwarsa, kata sandi lama/baru, pencabutan sesi/JWT,
dan penolakan redirect eksternal. Pengujian tidak mengirim email sungguhan.

Pemeriksaan browser pada lebar 390 px memastikan form tidak meluber, kondisi layanan
email belum tersedia ditampilkan, token dibersihkan dari URL, dan token tidak valid
ditolak tanpa menampilkan keberhasilan. Alur penggantian sukses diuji melalui service
dengan pengirim tiruan; pengiriman nyata Resend belum diverifikasi.
