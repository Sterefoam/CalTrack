# Perkiraan gram dengan ukuran pembanding

Halaman `/log/photo` pada mode akun meminta diameter piring 10–60 cm atau berat total
seluruh makanan 0,1–10.000 g. Foto dan acuan dikirim setelah pengguna menekan analisis.
Diameter hanya dipakai bila tepi piring terlihat; ketebalan dan kepadatan makanan tetap
merupakan asumsi. Berat kemasan hanya cocok bila seluruh isi tampak dan akan dimakan.
Berat piring/kemasan tidak termasuk. Mode demo tetap memakai contoh lokal.

`POST /api/analyze/photo` menerima multipart `photo` dan opsional `reference` berupa
JSON `{kind:"plate_diameter_cm"|"known_total_grams",value:number}`. Klien lama tanpa
acuan tetap kompatibel; antarmuka akun baru meminta acuan. Autentikasi, pembatasan
permintaan dan batas unggahan tetap berlaku. Foto dinormalisasi dan EXIF/GPS dibuang.

Layanan vision yang sudah dikonfigurasi menghasilkan komponen makanan dan rentang
berat yang harus melingkupi estimasi titik. Acuan piring yang tidak terlihat menghasilkan
`reference_not_visible` (422), bukan klaim pengukuran yang pasti. Untuk berat total yang
diketahui pengguna, server menyesuaikan berat semua komponen dan setiap nutrien dengan
faktor yang sama sehingga jumlah gram mengikuti acuan tersebut. Nilai akhir divalidasi
lagi memakai batas pencatatan makanan.

Respons menyertakan `photoAssessment`: metode, acuan, rentang awal tiap komponen,
catatan asumsi dan `calibrated:false`. Rentang keluaran vision belum merupakan interval
statistik terjamin. Halaman tinjauan menampilkannya sebagai perkiraan awal sebelum
koreksi; pengguna dapat mengubah gram dan gizi sebelum menyimpan. Analisis tidak
otomatis membuat catatan, dan foto asli tidak disimpan oleh alur ini.

Pengujian memakai respons provider tiruan untuk memeriksa acuan, penyesuaian gram/gizi,
rentang, penolakan respons rusak, dan pembatalan. Ini memverifikasi kontrak aplikasi,
bukan akurasi pengukuran gram di dunia nyata. Penggunaan langsung memerlukan
konfigurasi layanan vision server yang sama dengan fitur foto sebelumnya.
