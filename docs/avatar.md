# Avatar penjelajah

Avatar di `/quests`, `/profile` dan markas memakai `ExplorerDrawing` yang sama.
Karakter digambar sebagai penjelajah dengan pose bertumpu pada satu kaki, wajah,
rambut, tangan dan aksesori berlapis. Nama hadiah dan XP tetap berasal dari
`rewardDefinitions`; `avatarOutfit` memetakan hadiah ke bagian pakaian yang terlihat.

Tiga set menggunakan hadiah yang sudah ada, sehingga tidak memerlukan migrasi:

- Penjelajah bulan: syal biru, tas bekal dan sepatu perjalanan; tersedia sejak awal.
- Jubah orbit: jubah ungu, bros bulan dan tas bekal; terbuka pada 100 XP.
- Pemandu aurora: mantel hijau, topi penjelajah dan lentera; terbuka pada 300 XP.

Koleksi dapat dipratinjau termasuk ketika masih terkunci. Memilih pratinjau tidak
mengubah hadiah yang dipakai. Tombol Pakai penampilan memakai validasi server yang
sudah ada; set terkunci tidak dapat dipakai dan perubahan akun tersimpan setelah
muat ulang. Aksesori dalam satu set dipakai bersama. Profil dan markas selalu
menampilkan set aktif, bukan pilihan pratinjau yang belum disimpan.

## Arah visual dan gerak

Mempertahankan True-black flat, seed 162894889, serta palet malam dan tipografi
proyek; tidak ada redraw. Pertanyaan layar: seperti apa penjelajahku dan hadiah
mana yang bisa dipakai? Karakter berukuran besar dan koleksi di sebelahnya memberi
jawaban sekaligus tindakan. Pada mobile keduanya berurutan tanpa scroll horizontal.
Warna hangat pada kulit dan tas adalah warna ilustrasi, bukan seri data.

Gerak hanya aktif pada potret utama: bahu naik 1,5 piksel ketika bernapas, kedipan
singkat, perubahan sudut kepala 1,3 derajat dan ujung jubah kurang dari satu derajat.
Kaki tetap menapak; tidak ada bobbing seluruh tubuh, partikel, glow atau pantulan
elastis. Tombol Jeda gerak mematikan gerakan dan `prefers-reduced-motion` dihormati.
Thumbnail, markas dan profil tetap diam. Umpan balik XP dan pergantian hadiah juga
diperkecil dan percikan sebelumnya dihilangkan.
Gerak berhenti sementara ketika potret di luar layar atau tab browser tersembunyi.

`scripts/smoke-adventure.mjs` memeriksa pratinjau terkunci, aksesori SVG yang
terlihat, jeda gerak, konsistensi profil/markas, penyimpanan set akun, reduced motion
dan batas layout pada desktop, tablet dan mobile, di samping regresi quest.

Verifikasi 14 November 2026: build produksi, tiga tes layanan petualangan dan
seluruh pemeriksaan browser lulus, termasuk persistensi penampilan setelah reload
serta lebar 1440, 768, 390 dan 320 piksel. Semua tangkapan layar diperiksa. Inspector
desktop/tablet/mobile mencatat 0 FAIL; satu WARN desktop adalah jarak 49 piksel
yang memisahkan quest harian dan pilihan. Pemeriksaan ulang mobile setelah pilihan
set dibuat berjajar mencatat 0 FAIL dan 0 WARN. Tidak ada perubahan data contoh
atau aturan XP yang perlu diganti untuk menggunakan avatar ini.
