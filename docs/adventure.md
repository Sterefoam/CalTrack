# Quest pilihan dan animasi pencapaian

Tiga quest harian lama tetap tersedia dan mempertahankan XP yang sudah dimiliki.
Halaman `/quests` menampilkan empat pilihan tambahan dari sembilan variasi, berganti
setiap pukul 00.00 WIB. Akun dapat memilih maksimal dua per hari; pilihan berlaku
sampai pergantian hari dan tidak ada penalti jika belum selesai. Catatan yang sudah
tersimpan pada hari itu juga dihitung. Quest mengukur pencatatan, bukan jumlah
kalori yang dimakan, olahraga, atau pembatasan makan. Jalur foto, teks dan suara
memerlukan konfigurasi mesin analisis yang terpisah dari Luna.

`quest_selections` menyimpan pilihan dengan batas slot 1–2 serta keunikan akun,
hari, quest dan slot. Server memvalidasi daftar yang ditawarkan dan kondisi log,
menetapkan XP sendiri, serta memakai ledger klaim unik agar hadiah tidak berulang.
Migrasi `0010_optional_quests` diperlukan pada database lama. Demo memakai aturan
yang sama tetapi pilihan, XP dan hadiah hanya berlaku selama sesi.

Animasi muncul sesudah aksi yang benar-benar berhasil: pemberitahuan XP, perayaan
kenaikan level, daftar hadiah yang baru terbuka, dan gerakan singkat saat mengganti
hadiah. Tidak ada perayaan ketika memuat riwayat atau mengulang klaim yang sudah
selesai. Pemberitahuan tidak menahan klik pada aplikasi, dapat ditutup, dan berada
di atas navigasi bawah pada ponsel. Preferensi perangkat `prefers-reduced-motion`
menonaktifkan seluruh gerakan; teks pencapaian tetap dibaca pembaca layar.

Permintaan pembaruan progres yang lebih lama dibatalkan ketika aksi baru dimulai,
sehingga hasil baca lama tidak menimpa XP atau pilihan quest yang baru disimpan.

Verifikasi: build produksi dan tes layanan lulus; `scripts/smoke-adventure.mjs`
menguji kenaikan level, hadiah terbuka, pilihan bersamaan dengan batas dua slot,
klaim idempoten, pemuatan ulang, hasil baca lambat, serta reduced motion di browser.
Screenshot desktop/tablet/mobile diperiksa tanpa luapan horizontal. Pemeriksa desain
mencatat 0 FAIL dan dua peringatan: warna ilustrasi bukan seri chart, dan ruang 49px
memisahkan quest harian dari bagian quest pilihan yang berbeda fungsi.
