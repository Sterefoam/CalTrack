# Integrasi frontend akun

Form pendaftaran/login memakai Better Auth dengan cookie sesi. Provider Dashboard mengambil
profil, seluruh halaman riwayat hari ini dan ringkasan aktivitas akun. Kegagalan koneksi
menampilkan coba lagi; mode demo hanya dipilih otomatis setelah server memastikan tidak ada
sesi, atau melalui pilihan eksplisit pengguna. Data contoh tidak dicampur ke akun.

Onboarding dan profil menunggu PUT `/api/profile`. Tinjauan makanan menunggu POST
`/api/food-logs` sebelum menghapus draft dan menampilkan sukses. Riwayat mengambil semua
halaman cursor per tanggal/zona waktu browser. Pencarian dan barcode memakai katalog server;
produk dengan nilai gizi tidak lengkap diarahkan ke pengisian manual. Porsi mengubah semua
nilai gizi, termasuk natrium dalam mg.

Analisis foto, teks dan suara dalam mode akun memakai `/api/analyze/*`. UI menjelaskan
pengiriman ke AI dan mempertahankan input saat layanan gagal. Konfigurasi provider dibutuhkan
untuk hasil nyata; analisis tidak otomatis menyimpan konsumsi. Mode demo memakai contoh.

## Chat, quest, dan tampilan petualangan

Tombol Bertanya ke AI membuka Luna pada `/chat`. Akun mengambil status model dan
percakapan dari `/api/chat`; balasan berasal dari Ollama lokal dengan Qwen3 4B Instruct,
bukan simulasi. Kegagalan layanan mempertahankan pesan dan tidak membuat balasan contoh.
Ringkasan harian berasal dari akun; saran menu tidak mengubah makanan tercatat. Model
diinstruksikan untuk mengarahkan angka gizi menu ke pencatatan atau label bersumber.
Lihat [deployment AI lokal](./local-chat-deployment.md).

`/quests` memakai `/api/adventure` untuk progres, klaim XP dan hadiah kosmetik.
Klaim memvalidasi log server, dibatasi satu kali per akun/hari WIB/quest, dan memakai
transaksi. XP serta hadiah tersimpan setelah muat ulang; demo hanya berlaku selama sesi.
Markas, quest dan sidebar memakai satu AdventureProvider agar angka XP konsisten.

## Verifikasi

Build produksi dan 62 tes service/migrasi/ML/helper klien lulus (satu tes OCR nyata
memerlukan aktivasi terpisah). Pemeriksaan browser pada
database sementara dengan AI berbayar dimatikan mencakup registrasi, onboarding, pencarian
150 gram makanan (195 kkal), tinjauan, penyimpanan, muat ulang, dan riwayat. Profil/target
serta log tetap ada setelah muat ulang tanpa makanan contoh. Kegagalan analisis teks tanpa
provider menampilkan pesan dan mempertahankan input. Resep contoh 1,5 porsi (570 kkal)
disimpan setelah pengguna melengkapi serat, gula dan natrium; total akun menjadi 765 kkal.

Pemeriksaan tambahan memakai database sementara: akun baru 0 XP, penolakan klaim dini,
klaim bersamaan yang idempoten, tiga quest 100 XP, pemakaian dan penyimpanan Jubah orbit,
balasan model lokal nyata serta riwayat chat setelah muat ulang. Tiga belas rute mobile
diperiksa tanpa luapan horizontal atau galat halaman. Hasil tidak membuktikan akurasi
gizi atau seluruh kemungkinan jawaban model. Docker belum dijalankan pada mesin uji.

## Batas fitur

- Air minum dan olahraga dibaca dari akun saat masuk, tetapi perubahan UI masih berlaku
  selama sesi dan diberi penjelasan di Dashboard.
- Favorit makanan/resep masih selama sesi. Resep beserta nilai gizinya adalah contoh.
- Chat nyata memerlukan akun dan Ollama/model yang siap; mode demo meminta masuk.
- Barcode akun menerima kode yang diketik; pembacaan otomatis kamera belum diintegrasikan.
- Model ML lokal masih eksperimen dan belum terhubung ke analisis produksi. Hasil dan
  keterbatasannya ada di [food-recognition-ml.md](./food-recognition-ml.md).
- Verifikasi ini tidak menguji kualitas jawaban provider AI melalui panggilan berbayar.

Halaman `/settings` menyediakan akses profil/target dan pengaturan contoh waktu makan
serta jeda minum. Jadwal disimpan pada state sesi bersama, tidak mengirim notifikasi,
dan kembali ke nilai awal setelah muat ulang. Form memakai waktu perangkat, kontrol
aktif/nonaktif dan pesan hasil penyimpanan; tautan tersedia dari halaman profil.

Mode demo memuat ringkasan dari stub API asinkron lokal `loadDemoDashboard`: profil,
target, log, air dan olahraga diklon per permintaan. Stub dipakai setelah pemeriksaan
sesi menyatakan tidak ada akun, atau saat pengguna memilih demo pada layar error.
Jalur akun tetap mengambil API server; kegagalan akun tidak mengganti data secara diam-diam.
