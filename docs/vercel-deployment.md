# CalTrack di Vercel, Turso dan Groq

Gunakan Node.js 22 dan paket gratis untuk penggunaan pribadi selama kuota mencukupi. Ollama tetap tersedia untuk instalasi lokal/VPS, tetapi tidak dijalankan di Vercel Functions.

## Variabel server

Masukkan nilai melalui dashboard Vercel, jangan ke source atau chat:

| Variabel | Isi |
| --- | --- |
| `TURSO_DATABASE_URL` | URL `libsql://` database CalTrack |
| `TURSO_AUTH_TOKEN` | Token database tersebut |
| `BETTER_AUTH_SECRET` | Secret acak minimal 32 karakter |
| `BETTER_AUTH_URL` | Origin HTTPS deployment yang dipakai pengguna |
| `AI_PROVIDER` | `groq` |
| `CHAT_PROVIDER` | `groq` |
| `GROQ_API_KEY` | Key Groq server |

Opsional: `GROQ_CHAT_MODEL`, `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`, `GROQ_TRANSCRIPTION_MODEL`. Default teks/chat `openai/gpt-oss-20b`, gambar `qwen/qwen3.8-27b`, audio `whisper-large-v3-turbo`. Model gambar berstatus preview pada dokumentasi Groq saat integrasi; ketersediaannya dapat berubah. Pemilihan Groq tidak beralih otomatis ke OpenAI saat gagal. Konfigurasi OpenAI dan Ollama lama tetap didukung secara eksplisit.

Foto, teks dan audio dikirim ke Groq saat pengguna menjalankan analisis. Hasil estimasi tetap harus dikonfirmasi; tidak ada jaminan akurasi berat atau cakupan semua bahasa. OCR lokal membutuhkan data bahasa terpisah dan tidak disiapkan otomatis di Vercel. Pilihan AI otomatis membaca label melalui model gambar.

## Deploy

1. Buat database Turso kosong untuk CalTrack. Aplikasi tidak menyalin database lokal atau akun lokal ke cloud.
2. Jalankan `npm run db:migrate:remote` dengan variabel Turso tersedia di proses terminal yang aman. Migrasi memakai jurnal Drizzle dan dapat diulang. Jangan jalankan migrasi produksi di build preview atau request pengguna.
3. Link proyek dengan Vercel CLI. Set variabel di scope Production dan, jika digunakan, Preview dengan database terpisah. `.vercelignore` mengecualikan database, cache model, metadata agent dan file rahasia.
4. Deploy, lalu periksa pendaftaran/login, penyimpanan makanan, isolasi akun, quest/login harian, chatbot, foto dengan acuan, label dan audio. Gunakan origin yang cocok dengan `BETTER_AUTH_URL` untuk pengujian autentikasi.
5. Batasi unggahan foto/audio 4 MiB agar multipart berada di bawah batas payload Vercel. Jika kuota Groq habis, aplikasi menampilkan kegagalan dan pengguna masih bisa mengisi gizi manual.

Pemulihan password lewat email tetap memerlukan konfigurasi pengirim (`RESEND_API_KEY` dan `AUTH_EMAIL_FROM`) yang sudah didukung aplikasi.

## Hasil validasi integrasi

Uji langsung Groq berhasil untuk saran chatbot Indonesia, analisis dua makanan dari teks, serta label sintetis berbahasa Spanyol dan Jepang. Setelah skema JSON disertakan dalam instruksi model gambar, tujuh nilai gizi pada masing-masing label terbaca sesuai fixture: 240 kkal, protein 5,5 g, karbohidrat 30 g, lemak 9 g, serat 2 g, gula 0 g dan natrium 120 mg. Label Jepang mencetak garam 0,3 g, yang dikonversi server menjadi natrium 120 mg.

Hasil tersebut adalah pemeriksaan integrasi dengan contoh terkontrol, bukan ukuran akurasi pada kemasan nyata atau bukti cakupan semua bahasa. Percobaan awal sebelum perbaikan menghasilkan keluaran tidak valid; kuota token per menit Groq juga sempat menolak permintaan. Aplikasi tetap memvalidasi keluaran dan meminta konfirmasi pengguna.

Dokumentasi: https://console.groq.com/docs/models, https://console.groq.com/docs/structured-outputs, https://docs.turso.tech/sdk/ts/reference, https://vercel.com/docs/functions/limitations.
