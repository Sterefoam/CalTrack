# Luna: AI tanpa API berbayar

Luna memakai Ollama dan Qwen3 4B di server sendiri. Browser hanya mengakses `/api/chat`; alamat Ollama tidak diberikan kepada browser. Riwayat dan ringkasan nutrisi dibatasi ke akun yang masuk. Tidak ada balasan simulasi ketika mesin AI gagal.

## Di komputer sendiri

Pasang Ollama dari https://ollama.com/download lalu jalankan `ollama pull qwen3:4b-instruct`. Jalankan Ollama, kemudian aplikasi seperti biasa. Pengaturan bawaan: `CHAT_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=qwen3:4b-instruct`. Masuk ke akun dan buka Asisten. Model berjalan lokal tanpa API key. Respons pertama dapat lebih lama saat model dimuat.

## Deploy dengan Docker Compose

Gunakan server Linux dengan Docker Compose, minimal 8 GB RAM dan ruang kosong sekitar 12 GB. 16 GB RAM atau GPU yang kompatibel disarankan untuk respons cepat. Model gratis; sewa server dan listrik mengikuti penyedia masing-masing.

1. Atur variabel `BETTER_AUTH_URL` ke alamat HTTPS publik dan `BETTER_AUTH_SECRET` ke nilai acak minimal 32 karakter melalui pengaturan deployment. Jangan commit rahasia.
2. Jalankan `docker compose up -d --build`. Layanan `model-init` mengunduh model satu kali ke volume, lalu aplikasi memigrasikan database dan mulai berjalan.
3. Hubungkan reverse proxy HTTPS ke `127.0.0.1:3000`. Ollama hanya tersedia di jaringan internal Compose. Jangan membuka port 11434 ke internet.
4. Buka aplikasi, masuk, lalu periksa indikator koneksi di Asisten. Uji pengiriman pesan dan buka ulang percakapan. Pantau `docker compose logs app ollama` jika koneksi belum siap.

Volume `app-data` menyimpan akun, quest dan percakapan; `model-data` menyimpan bobot model. Cadangkan database sebelum pembaruan. Perintah `docker compose down` mempertahankan volume; opsi `-v` menghapus data sehingga jangan digunakan tanpa cadangan.

### VPS dengan HTTPS otomatis

Untuk pilihan gratis, Oracle Cloud Always Free menyediakan VM sesuai kuota akun
dan ketersediaan region. Pendaftaran memerlukan verifikasi kartu oleh pemilik akun.
Pilih resource berlabel Always Free, bukan sekadar resource yang memakai kredit
trial. Pada Console, buat Compute Instance dengan Ubuntu dan RAM setidaknya 8 GB;
simpan SSH key di komputer sendiri. Public IP muncul di detail instance dan
username Ubuntu biasanya `ubuntu`. Jangan mengirim private key atau data kartu
melalui chat. Rujukan kuota terbaru:
https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

Sebelum memasang aplikasi, periksa resource di VPS serta layanan yang sudah
berjalan, instal Docker Compose bila belum tersedia, dan atur ingress jaringan
serta firewall server untuk HTTPS. Cadangkan database deployment lama sebelum
memperbarui checkout. Jika belum memiliki domain, tentukan hostname gratis yang
mengarah ke Public IP sebelum mengaktifkan sertifikat.

Untuk server yang belum memiliki reverse proxy, `compose.production.yaml` menambahkan
Caddy. Arahkan DNS domain ke IP VPS dan sediakan port 80/443. Atur `CALTRACK_DOMAIN`
berisi hostname saja (misalnya `caltrack.example.com`) serta `BETTER_AUTH_SECRET`
melalui pengaturan rahasia server. `BETTER_AUTH_URL` mengikuti domain yang sama;
Compose dasar juga meminta nilai ini, jadi tetapkan `https://` diikuti domain.

Jalankan dari checkout aplikasi pada VPS:

```sh
docker compose -f compose.yaml -f compose.production.yaml config --quiet
docker compose -f compose.yaml -f compose.production.yaml up -d --build
docker compose -f compose.yaml -f compose.production.yaml ps --all
```

Caddy mengurus sertifikat dan pengalihan HTTP ke HTTPS. Jangan menjalankan proxy ini
jika port 80/443 sudah dipakai proxy lain; gunakan konfigurasi Compose dasar dan
hubungkan proxy yang sudah ada. Port aplikasi tetap hanya di loopback VPS; Ollama
hanya di jaringan Compose. Volume sertifikat disimpan agar restart tidak meminta
sertifikat baru setiap kali. Setelah deploy, periksa login, simpan catatan, klaim
hadiah harian, muat ulang halaman, dan kirim pesan Luna. Kontainer menyala saja belum
membuktikan seluruh alur itu berhasil.

Hosting serverless saja (misalnya Vercel) tidak menjalankan Ollama di dalam fungsi. Jika frontend ditempatkan di sana, sediakan server Ollama terpisah yang dapat diakses backend melalui jaringan privat atau proxy terautentikasi, dan atur `OLLAMA_BASE_URL` di server. Jangan memakai `localhost` untuk menunjuk komputer pribadi dari deployment publik. Timeout platform harus setidaknya 120 detik. Paket hosting gratis belum tentu menyediakan RAM, durasi, dan penyimpanan yang cukup.

Model ini untuk saran umum, bukan nasihat klinis. Prompt melarang model mengarang angka gizi menu dan mengarahkannya ke pencatatan atau label; angka ringkasan harian berasal dari database akun. Instruksi model tidak menjamin jawaban selalu benar, sehingga saran tetap perlu ditinjau. Konfigurasi ini hanya mengganti chatbot; pembaca foto makanan memiliki konfigurasi terpisah.

