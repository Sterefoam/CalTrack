# Luna: AI tanpa API berbayar

Luna memakai Ollama dan Qwen3 4B di server sendiri. Browser hanya mengakses `/api/chat`; alamat Ollama tidak diberikan kepada browser. Riwayat dan ringkasan nutrisi dibatasi ke akun yang masuk. Tidak ada balasan simulasi ketika mesin AI gagal.

## Di komputer sendiri

Pasang Ollama dari https://ollama.com/download lalu jalankan `ollama pull qwen3:4b`. Jalankan Ollama, kemudian aplikasi seperti biasa. Pengaturan bawaan: `CHAT_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=qwen3:4b`. Masuk ke akun dan buka Asisten. Model berjalan lokal tanpa API key. Respons pertama dapat lebih lama saat model dimuat.

## Deploy dengan Docker Compose

Gunakan server Linux dengan Docker Compose, minimal 8 GB RAM dan ruang kosong sekitar 12 GB. 16 GB RAM atau GPU yang kompatibel disarankan untuk respons cepat. Model gratis; sewa server dan listrik mengikuti penyedia masing-masing.

1. Atur variabel `BETTER_AUTH_URL` ke alamat HTTPS publik dan `BETTER_AUTH_SECRET` ke nilai acak minimal 32 karakter melalui pengaturan deployment. Jangan commit rahasia.
2. Jalankan `docker compose up -d --build`. Layanan `model-init` mengunduh model satu kali ke volume, lalu aplikasi memigrasikan database dan mulai berjalan.
3. Hubungkan reverse proxy HTTPS ke `127.0.0.1:3000`. Ollama hanya tersedia di jaringan internal Compose. Jangan membuka port 11434 ke internet.
4. Buka aplikasi, masuk, lalu periksa indikator koneksi di Asisten. Uji pengiriman pesan dan buka ulang percakapan. Pantau `docker compose logs app ollama` jika koneksi belum siap.

Volume `app-data` menyimpan akun, quest dan percakapan; `model-data` menyimpan bobot model. Cadangkan database sebelum pembaruan. Perintah `docker compose down` mempertahankan volume; opsi `-v` menghapus data sehingga jangan digunakan tanpa cadangan.

Hosting serverless saja (misalnya Vercel) tidak menjalankan Ollama di dalam fungsi. Jika frontend ditempatkan di sana, sediakan server Ollama terpisah yang dapat diakses backend melalui jaringan privat atau proxy terautentikasi, dan atur `OLLAMA_BASE_URL` di server. Jangan memakai `localhost` untuk menunjuk komputer pribadi dari deployment publik. Timeout platform harus setidaknya 120 detik. Paket hosting gratis belum tentu menyediakan RAM, durasi, dan penyimpanan yang cukup.

Model ini untuk saran umum, bukan nasihat klinis atau angka gizi terverifikasi. Nilai gizi yang diberikan model tetap estimasi. Konfigurasi ini hanya mengganti chatbot; pembaca foto makanan memiliki konfigurasi terpisah.
