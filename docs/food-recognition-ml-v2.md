# Pelatihan pengenal makanan v2

Eksperimen lanjutan ini menambah sumber gambar dan melakukan fine-tuning dua model
di GPU lokal. Model memprediksi jenis makanan; integrasi analisis foto aplikasi masih
memakai penyedia yang dijelaskan pada dokumentasi backend. Artefak v1 dipertahankan.

## Data dan lisensi

- Wikimedia Commons: kategori hidangan, termasuk makanan Indonesia. Tiap gambar
  memerlukan lisensi CC BY, CC BY-SA, CC0, atau public domain dan nama pembuat.
  Kategori menjadi label lemah yang belum seluruhnya ditinjau manual.
- [Open Images v5](https://storage.googleapis.com/openimages/web/download_v5.html):
  metadata resmi bounding box serta atribusi gambar dari subset sumber validation
  dan test. Nama subset sumber tersebut **bukan** pembagian evaluasi CalTrack.
  Kolektor hanya menerima gambar berlisensi CC BY 2.0 dengan nama pembuat.
  Satu foto menghasilkan satu crop dari bounding box makanan terbesar; foto dengan
  beberapa label makanan target atau depiction dilewati. Foto makanan yang terhalang,
  terpotong atau berkelompok tetap diterima, dengan flag anotasi tercatat agar variasi
  sulit juga terwakili. Luas box minimal 15% foto dan sisi crop minimal 96 piksel.

Manifest lokal menyimpan sumber, lisensi, pembuat, perubahan, hash dan bounding box.
Gambar, bobot, cache Python dan manifest berada di `.caltrack/ml/`, diabaikan Git
dan sinkronisasi. Tidak ada foto pengguna atau panggilan layanan pelatihan berbayar.
Pengunduh membatasi ukuran respons serta jumlah permintaan. Pembatasan Wikimedia
menghambat penambahan kategori Indonesia pada percobaan ini; jangan menganggap
seluruh kategori calon sudah tersedia atau sudah dipelajari model.

## Pemisahan dan pemilihan model

Semua 873 foto v1 dijadikan latih saja, karena hasil pengujian v1 sudah pernah dilihat.
Uji v1 dipensiunkan, bukan dipakai lagi untuk memilih konfigurasi v2.
Foto baru dikelompokkan dengan exact hash, perceptual dHash (jarak <=5), dan identitas
foto sumber. Kelompok duplikat hanya boleh berada pada satu pembagian; label yang
bertentangan dikeluarkan. Kategori evaluasi memerlukan minimal 25 kelompok independen
serta minimal 5 kelompok validasi dan 5 kelompok uji. Pembagian dibekukan sebelum latih.
Validasi dan uji memakai satu foto wakil per kelompok duplikat agar foto yang nyaris
sama tidak menggandakan bobot skor atau mempersempit interval statistik secara semu.

Kategori lama dengan minimal 12 kelompok yang belum punya cukup foto baru tetap
dipelajari dari data latih. Laporan menandainya `legacy-train-only-unmeasured` dan
menyimpan daftar `unmeasuredLabels`. Recall dan F1 kategori tanpa dukungan uji bernilai
`null`; macro-F1 hanya merata-ratakan kategori dengan dukungan uji. Kategori tersebut
tetap merupakan kemungkinan keluaran model, termasuk saat memprediksi foto uji lain.

Eksperimen membandingkan probe linear berbobot kelas di atas EfficientNet-B0 beku,
EfficientNet-B0 yang dilatih ulang, dan ConvNeXt-Tiny yang dilatih ulang. Keduanya
diawali bobot ImageNet TorchVision. Dua epoch awal melatih head; berikutnya membuka
backbone, memakai AdamW, cosine learning rate, augmentasi crop/flip/warna/rotasi,
label smoothing, AMP dan gradient clipping. Checkpoint dan penghentian dini ditentukan
oleh macro-F1 validasi, dengan top-1 sebagai pemecah seri.

Pemilihan akhir membandingkan model dan ensemble berbobot menggunakan validasi saja,
dengan rerata logits crop tengah dan flip horizontal. `selection.json` mencatat bahwa
test belum diakses. Tahap `evaluate` kemudian mengukur test sekali dan menolak
menimpa laporan uji yang sudah disegel. Perbandingan berikutnya memerlukan protokol
dan foto uji baru; jangan menyesuaikan model berdasarkan kekeliruan test ini.

## Menjalankan ulang

Node.js, dependensi proyek, Python, serta driver NVIDIA yang mendukung CUDA 12.8
diperlukan untuk jalur GPU yang digunakan pada percobaan ini. Pasang paket Python
ke direktori proyek; skrip memuatnya secara eksplisit, termasuk pada embedded Python.

```sh
python -m pip install --target .caltrack/ml/python-packages -r scripts/ml/requirements-gpu.txt
node scripts/ml/collect-expanded.mjs
python scripts/ml/collect-openimages.py --per-class 120
node scripts/ml/build-expanded.mjs
python scripts/ml/train-expanded.py prepare
python scripts/ml/train-expanded.py train --run v2 --epochs 35 --patience 8
python scripts/ml/train-expanded.py evaluate --run v2
node scripts/ml/export-report.mjs
python scripts/ml/predict-expanded.py /path/to/food.jpg --run v2
node --test tests/ml.test.mjs tests/ml-expanded.test.mjs
python tests/ml_training_test.py
python tests/ml_collection_test.py
```

Jalankan kedua kolektor sampai berhenti sebelum membuat pembagian final. Jangan
mengubah manifest, pembagian atau gambar selama latihan/evaluasi. Kolektor bisa
dilanjutkan dari manifest. Jika server memberi pembatasan, tunggu sesuai responsnya.
Pengunduh Commons dapat memerlukan waktu lama; tidak perlu memaksanya selesai untuk
melatih model dari data yang sudah tersimpan. Gunakan nama run baru jika dataset
berubah. Seed, fingerprint, versi pustaka, GPU dan riwayat epoch dicatat secara lokal.

## Hasil dan batas penggunaan

<!-- results:start -->
Percobaan GPU pada 2026-11-13: **57 kategori dipelajari**,
dengan **43 kategori mempunyai dukungan uji baru** dan
14 kategori lama belum terukur ulang.
Koleksi: 4642 foto (1030 Commons + 3612 Open Images).
Setelah penyaringan: 4579 foto; 63 dikeluarkan.
Pembagian: 3381 latih, 599 validasi, 599 uji.

| Model pada holdout v2 yang sama | Top-1 | Top-3 | Macro-F1 terukur |
| --- | ---: | ---: | ---: |
| Ensemble terpilih dari validasi | 85.64% | 94.66% | 0.8291 |
| linear-probe | 78.96% | 92.99% | 0.7694 |
| efficientnet_b0 | 76.13% | 90.82% | 0.7418 |
| convnext_tiny | 85.48% | 94.16% | 0.8349 |

Hasil utama: 513/599 prediksi pertama benar.
Interval Wilson 95% untuk top-1: **82.61%–88.22%**.
Bobot ensemble: 0.5 / 0 / 0.5; suhu 1.5.
Model dipilih sebelum test dibuka; skor model pembanding dilaporkan untuk konteks, bukan untuk mengganti pemenang setelah melihat test.

Kategori dengan dukungan uji baru:
anggur, apel, bakso, brokoli, burger, burrito, croissant, donat, es-krim, grapefruit, hotdog, jeruk, keju, kentang, kentang-goreng, kubis, kukis, lemon, mentimun, muffin, nanas, nasi-goreng, pancake, paprika, pasta, persik, pir, pisang, pizza, popcorn, rendang, roti, salad, sandwich-sub, sate, semangka, stroberi, sushi, taco, tart, tomat, waffle, wortel.

Kategori yang dipelajari tetapi belum mempunyai dukungan uji v2:
ayam-goreng, gado-gado, gudeg, martabak, mie-goreng, nasi-kuning, nasi-uduk, pempek, pisang-goreng, ramen, rawon, siomay, soto, tempe.

| Kelompok foto uji | Jumlah | Top-1 |
| --- | ---: | ---: |
| openImagesCrops | 552 | 88.22% |
| commonsFullImages | 47 | 55.32% |
| partialOrGroupedFood | 308 | 87.66% |

Kelompok memiliki komposisi kelas berbeda; selisih antar sumber bukan pengukuran kausal kualitas sumber atau peningkatan pada foto pengguna.
<!-- results:end -->

Hasil terukur tersedia pada [laporan v2](food-recognition-ml-v2-report.json), termasuk
jumlah foto per pembagian, kategori yang benar-benar diuji, model terpilih,
top-1/top-3, macro-F1, interval Wilson 95% dan confusion matrix.

Akurasi v2 tidak dapat dibandingkan langsung dengan angka 59,5% v1 karena jenis,
jumlah dan foto uji berbeda. Bandingkan fine-tuning dengan probe beku pada holdout v2
yang sama. Crop Open Images juga lebih mudah daripada foto sepiring makanan campuran.
Belum ada benchmark independen terhadap foto pengguna atau penyedia analisis produksi.
Foto dari sesi/fotografer yang sama mungkin tersisa di pembagian berbeda; tumpang
tindih dengan pretraining ImageNet tidak dapat dikesampingkan.

Ini model closed-set: makanan di luar kelas tetap dapat dipaksa menjadi salah satu
kelas. Skor softmax belum terkalibrasi. Label jenis makanan tidak mengukur gram,
minyak, kalori atau makronutrisi. Artefak tetap `experimental: true` dan
`productionEnabled: false`; akurasi tertinggi universal belum dapat dibuktikan.
