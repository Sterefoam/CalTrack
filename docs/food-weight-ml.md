# Perkiraan berat makanan dengan machine learning

Percobaan offline GPU pada 2026-11-13, menggunakan **3262 foto Nutrition5k** dengan anotasi berat total makanan hasil timbangan. Ini adalah regresi gram, bukan akurasi pengenalan jenis makanan.

| Pembagian | Foto |
| --- | ---: |
| train | 2224 |
| validation | 386 |
| calibration | 145 |
| test | 507 |

| Hasil pada uji resmi yang disegel | Model terpilih | Tebakan median data latih |
| --- | ---: | ---: |
| Rata-rata kesalahan absolut | 37.92 g | 115.86 g |
| Median kesalahan absolut | 25.61 g | 98.50 g |
| RMSE | 56.36 g | 152.24 g |
| MAPE | 39.04% | 182.50% |
| Dalam toleransi 20% berat asli | 56.21% | 17.55% |
| Dalam selisih 50 g | 74.95% | 24.85% |

Model dipilih berdasarkan MAE validasi: **finetuned-log-mass**, 47.39 g. Kandidat meliputi median data latih, EfficientNet-B0 beku dengan regresi ridge log-mass, dan fine-tuning EfficientNet-B0. Checkpoint dan kandidat dipilih sebelum membuka uji. Tidak ada penyesuaian memakai hasil uji.

Kalibrasi memakai 145 foto pada hari pengambilan yang terpisah dari latih/validasi. Rentang split-conformal menargetkan 90% cakupan pada domain sejenis; radius 78.87 g. Cakupan uji aktual **86.59%**, lebar rata-rata 151.54 g. Ini bukan jaminan untuk foto di luar domain. Foto uji yang berdekatan dapat berkorelasi.

## Sumber dan pencegahan kebocoran

- [Nutrition5k, Quin Thames et al., CVPR 2021](https://github.com/google-research-datasets/Nutrition5k), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Atribusi, URL asli, dan perubahan ukuran/format disimpan dalam manifest lokal.
- Memakai overhead RGB dan berat total hidangan yang dapat dimakan, tanpa video atau depth. 0 duplikat/konflik dikeluarkan. Tiga unduhan gagal dari 3.265 ID overhead resmi; tidak diganti dengan contoh buatan.
- Pembagian test resmi dipertahankan; data latih resmi dibagi lagi menurut hari pengambilan UTC untuk validasi dan kalibrasi. Uji hash/fingerprint mencegah foto yang sama melintasi pembagian.
- Seluruh piring dipertahankan saat resize; tidak memakai random crop yang dapat mengubah luas makanan tanpa mengubah label gram.

## Batas penerapan

**Masih eksperimental dan belum diaktifkan sebagai model produksi aplikasi.** Rig kamera, ukuran piring, dan menu kantin pada dataset berbeda dari foto telepon pengguna. Hidangan Indonesia, skala piring bervariasi, makanan tersembunyi, dan kondisi cahaya baru belum tervalidasi. Hasil ini tidak membuktikan berat pasti dari satu foto. Protokol RGB/hari pengambilan ini berbeda dari eksperimen video/depth pada makalah asli.

Aplikasi memakai layanan vision yang dikonfigurasi dan ukuran pembanding pengguna; implementasinya dijelaskan di [photo-weight.md](photo-weight.md). Belum ada uji timbangan yang membandingkan layanan aplikasi dengan model riset ini. Hasil klasifikasi 57 kategori juga berasal dari dataset dan tujuan berbeda.

## Menjalankan ulang

Dependensi lokal riset sama dengan eksperimen pengenal makanan di [food-recognition-ml-v2.md](food-recognition-ml-v2.md).

```text
node scripts/ml/collect-portion.mjs
python scripts/ml/train-portion.py train --run mass-v1 --epochs 30
python scripts/ml/train-portion.py evaluate --run mass-v1
python scripts/ml/predict-portion.py PATH_FOTO --run mass-v1
node scripts/ml/export-portion-report.mjs
```

Tahap evaluate hanya dijalankan sekali dan menolak menimpa laporan yang sudah disegel. Untuk penelitian baru, gunakan kumpulan uji baru yang belum dipakai memilih model. Foto, paket Python, checkpoint, dan cache berada di .caltrack/ yang diabaikan Git; GitHub berisi alat, protokol, dan laporan terukur.
