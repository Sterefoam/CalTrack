# Eksperimen pengenalan foto makanan

Dokumen ini menyimpan percobaan awal (v1). Penambahan data, kategori, dan fine-tuning
GPU berikutnya didokumentasikan terpisah pada [eksperimen v2](food-recognition-ml-v2.md).
Angka kedua eksperimen memakai foto dan cakupan kategori berbeda.

Permintaan tambahan pengguna: kumpulkan data makanan dari web dan coba machine learning
untuk membantu pengenalan foto. Implementasi ini melatih pengenal jenis hidangan lokal;
belum diaktifkan pada endpoint analisis foto aplikasi.

## Sumber dan hak penggunaan

Sumber gambar adalah [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia).
Pengunduh memeriksa lisensi tiap gambar: CC BY, CC BY-SA, CC0, atau public domain dengan
identitas pembuat. Lisensi NC, unknown, fair use, dan metadata pembuat kosong dilewati.
API `imageinfo/extmetadata` menyediakan atribusi dan halaman asal. Manifest mencatat
pembuat, URL lisensi, halaman sumber, URL asli/unduhan, waktu unduh, hash dan perubahan
gambar. Kategori Commons menjadi label lemah; semua gambar belum ditinjau manual.
Gambar turunan tetap tunduk pada lisensi sumber, termasuk share-alike bila berlaku.

Open Food Facts dipertahankan untuk katalog gizi/barcode; datanya bukan label berat porsi
untuk foto hidangan. [Dokumentasi resminya](https://openfoodfacts.github.io/openfoodfacts-server/api/)
mengarahkan pengambilan massal ke dump data, bukan membanjiri endpoint pencarian.

## Menjalankan

Prasyarat: dependensi pengembangan terpasang dan Node.js. Semua hasil berada di
`.caltrack/ml/`, diabaikan Git dan sinkronisasi metadata. Gambar pengguna tidak dikumpulkan.

```sh
node scripts/ml/collect.mjs
node scripts/ml/train.mjs
node scripts/ml/predict.mjs /path/to/local-food-photo.jpg
node --test tests/ml.test.mjs
```

Kolektor mencoba 25 kategori, maksimal 50 gambar/kategori secara bawaan.
`ML_IMAGES_PER_CLASS` dapat diatur 12–500 untuk memperluas koleksi. Kolektor dapat dilanjutkan
dengan manifest yang sama, membatasi ukuran respons, memberi jeda, dan melakukan retry
terbatas saat menerima 429/503. Tidak ada akses login/paywall atau scraping Google Images.

## Metode dan evaluasi

- Transfer learning: encoder pretrained `Xenova/clip-vit-base-patch16` q8 di CPU,
  revisi model dipin ke commit Hugging Face. Fitur gambar 512 dimensi dinormalisasi.
- SHA-256 dan perceptual difference hash mengelompokkan gambar duplikat/mirip. Kelompok
  dengan label bertentangan dikeluarkan. Satu kelompok hanya masuk satu split.
- Kelas perlu minimal 12 kelompok independen. Pembagian deterministik sekitar 70% latih,
  15% validasi, 15% uji; tidak ada augmentasi yang menyeberangi split.
- Head softmax linear berbobot kelas dilatih 100 epoch, membandingkan tiga regularisasi
  dan baseline nearest-centroid. Pemilihan hanya memakai macro-F1 validasi.
- `report.json` berisi hasil test top-1/top-3, macro-F1, confusion matrix, jumlah per kelas,
  model terpilih, fingerprint dataset, dan keterbatasan. `classifier.json` menyimpan head.
- Prediksi menghasilkan kandidat jenis hidangan. Skor belum terkalibrasi sebagai probabilitas.

Encoder memakai [Transformers.js](https://huggingface.co/docs/transformers.js/index),
dengan API ekstraksi gambar yang diperiksa melalui Context7 CLI.

## Hasil percobaan 5 November 2026

Kolektor mengunduh 873 gambar berlisensi; 855 gambar masuk 22 kelas setelah penyaringan.
Pembagian: 623 latih, 116 validasi, 116 uji. Model terpilih adalah softmax linear berbobot
kelas dengan regularisasi 0,0001, dipilih menggunakan macro-F1 validasi (0,557).

Pada foto uji, top-1 **59,5%** (69/116), top-3 **80,2%** (93/116), macro-F1 **0,535**.
Ukuran uji per kelas hanya 2–7 foto: gudeg, nasi uduk, dan siomay belum mendapat prediksi
top-1 benar. Angka ini belum cukup untuk mengaktifkan model pada pengguna.
Laporan rinci, confusion matrix, revisi encoder, dan fingerprint dataset tersedia di
[food-recognition-ml-report.json](./food-recognition-ml-report.json).
Prediksi offline juga telah diuji pada satu foto nasi goreng di split uji.

Prioritas eksperimen berikutnya adalah peninjauan label, menambah data kelas yang lemah,
dan benchmark independen foto nyata dengan makanan campuran serta kategori tidak dikenal.
Gunakan validasi untuk memilih model; jangan memilih konfigurasi berdasarkan skor uji ini.

## Batas klaim produksi

Akurasi test koleksi Commons bukan bukti peningkatan atas model OpenAI yang saat ini dipakai.
Perlu benchmark independen foto pengguna dengan hidangan campuran, makanan di luar kelas,
variasi cahaya/kamera, serta review label. Pengelompokan perceptual mengurangi kebocoran
duplikat; foto berbeda dari sesi atau fotografer yang sama masih mungkin melintasi split.

Model klasifikasi ini tidak dilatih untuk gram, kalori, atau makronutrisi. Berat porsi dan
minyak/bahan tersembunyi tidak bisa ditetapkan akurat hanya dari label hidangan.
Artefak menyatakan `experimental: true` dan `productionEnabled: false`. Jalur OpenAI aplikasi
tetap berlaku sampai perbandingan independen membuktikan manfaat model tambahan.
