# Pengenal makanan v3: tambahan foto dan pengujian baru

Eksperimen ini menambah 1.061 foto Open Images berlisensi CC BY 2.0. Koleksi lokal menjadi 5.703 foto (1.030 Commons + 4.673 Open Images). Variasi gambar bertambah, sedangkan kosakata tetap 57 kategori agar model lama dan baru bisa dibandingkan langsung. Bobot dan gambar tetap lokal di `.caltrack/ml/`, diabaikan Git dan sinkronisasi. Atribusi setiap foto tersimpan pada manifest kolektor.

## Protokol

Data latih v2 tetap latih; validasi v2 tetap validasi. Seluruh foto uji v2 dan kelompok duplikatnya dikarantina, termasuk foto yang sebelumnya dikeluarkan. Tidak ada foto dari uji v2 yang dimasukkan ke latihan ini. Duplikat exact/perceptual, hash dan identitas sumber dikelompokkan sebelum pembagian; setiap kelompok hanya boleh berada di satu bagian. Pembagian v3 dibekukan sebelum pelatihan.

Setelah penyaringan: 4050 latih, 795 validasi, 196 uji baru. Hanya 11 dari 57 kategori mempunyai cukup foto baru untuk diukur pada uji ini. Kategori lain tetap dapat diprediksi, tetapi tidak punya pengukuran ulang v3.

EfficientNet-B0 dan ConvNeXt-Tiny dilanjutkan dari checkpoint v2 pada resolusi 256 piksel. Augmentasi crop/flip/warna, AdamW, cosine learning rate, label smoothing dan AMP digunakan. Pelatihan dibatasi 12 epoch per arsitektur, dengan penghentian dini. Checkpoint dipilih dari top-1 validasi, macro-F1 sebagai pemecah seri.

Pemilihan ensemble mencoba bobot kelipatan 0,25 atas ensemble v2 beku serta kedua hasil fine-tuning. Hanya validasi digunakan untuk pemilihan. Model v2 menggunakan transformasi dan suhu aslinya; model yang dilatih ulang memakai crop 256 piksel. Logits crop tengah dan flip dirata-ratakan. Setelah pemilihan dibekukan, uji baru dibuka sekali; skrip menolak latihan/evaluasi lanjutan pada run yang laporannya sudah disegel.

## Hasil pada foto uji baru yang sama

Tanggal laporan: 2026-11-13.

| Model | Benar | Top-1 | Top-3 | Macro-F1 terukur |
| --- | ---: | ---: | ---: | ---: |
| Ensemble v2 beku | 157/196 | 80.10% | 96.43% | 0.8506 |
| Pilihan validasi v3 | 165/196 | 84.18% | 96.94% | 0.8753 |

Selisih top-1: +4.08 poin persentase. Pasangan prediksi: 10 foto membaik dan 2 foto memburuk.
Interval Wilson 95% pilihan v3: 78.42%–88.63%. Bobot [v2 beku, B0 baru, ConvNeXt baru]: 0.5 / 0.25 / 0.25.

Skor ini tidak sebanding langsung dengan headline 85,64% pada laporan v2: komposisi uji berbeda dan v3 hanya mengukur kategori dengan foto tambahan yang cukup. Pemilihan tidak diubah setelah melihat hasil uji. Selisih kecil bukan bukti peningkatan universal atau jaminan statistik pada semua jenis makanan.

Kategori terukur: apel, burger, es-krim, kentang-goreng, kukis, muffin, pasta, pizza, roti, salad, tart.

Belum terukur ulang: anggur, ayam-goreng, bakso, brokoli, burrito, croissant, donat, gado-gado, grapefruit, gudeg, hotdog, jeruk, keju, kentang, kubis, lemon, martabak, mentimun, mie-goreng, nanas, nasi-goreng, nasi-kuning, nasi-uduk, pancake, paprika, pempek, persik, pir, pisang, pisang-goreng, popcorn, ramen, rawon, rendang, sandwich-sub, sate, semangka, siomay, soto, stroberi, sushi, taco, tempe, tomat, waffle, wortel.

## Menjalankan

Gunakan Python dan dependensi GPU dari petunjuk v2. Jalankan dari root proyek:

```sh
python scripts/ml/collect-openimages.py --per-class 240
node scripts/ml/build-refinement.mjs
python scripts/ml/train-refinement.py train --run v3 --epochs 12 --batch-size 12 --workers 2
python scripts/ml/train-refinement.py evaluate --run v3 --batch-size 12 --workers 2
node scripts/ml/export-refinement-report.mjs
python scripts/ml/predict-refinement.py /path/to/food.jpg
```

Jangan menimpa pembagian atau laporan uji yang sudah ada. Eksperimen berikutnya memerlukan protokol dan uji baru, tanpa menyesuaikan model terhadap kesalahan pada uji ini. Jalur multiprocessing Windows mendaftarkan modul pelatihan agar DataLoader dapat memuat dataset dengan benar.

## Batas penggunaan

Ini penelitian offline (`experimental: true`, `productionEnabled: false`). Aplikasi analisis foto tetap menggunakan penyedia vision yang dikonfigurasi; hasil ini tidak otomatis memperbaiki penyedia tersebut. Model masih closed-set dengan skor belum terkalibrasi. Tidak memprediksi gram, kalori atau kandungan gizi. Tidak ada pengukuran pada foto pengguna, makanan di luar kosakata, atau seluruh 57 kategori. Tumpang tindih fotografer/sesi dan data pretraining mungkin tersisa. Akurasi tertinggi universal belum dibuktikan.

Lihat [laporan terstruktur](food-recognition-ml-v3-report.json) untuk confusion matrix, dukungan per kelas, parameter dan lingkungan pelatihan.
