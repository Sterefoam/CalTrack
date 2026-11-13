# CalTrack — desain petualangan malam

Arah: True-black flat, seed 162894889. Struktur memakai permukaan datar dan navigasi netral. Palet navy/ungu dan ilustrasi bulan mengikuti referensi pengguna, sehingga menjadi pengecualian atas aturan warna netral. Font Inter di-host sendiri dengan lisensi OFL.

Pertanyaan markas: apa yang sudah dicatat hari ini dan langkah kecil apa berikutnya? Data kalori, makro dan catatan berasal dari DashboardProvider yang membedakan akun dan demo. Tidak ada XP contoh yang diklaim sebagai hasil pengguna. Quest harian memakai hari WIB dan data makanan tersimpan di server; klaim dibatasi satu per quest per hari. Nilai XP 20/35/45 per quest dan hadiah 0/100/300 XP adalah aturan permainan, bukan ukuran kesehatan.

Pertanyaan chat: makanan apa yang sesuai konteks hari ini? Luna mengakses ringkasan harian akun melalui server, menyimpan riwayat, mempertahankan pesan saat gagal, dan menampilkan kesiapan model. Demo tidak mengaku terhubung ke AI.

Tanda khas: lanskap bulan, tenda dan penjelajah dengan warna jubah sesuai hadiah. Semua ilustrasi digambar untuk aplikasi, tanpa menyalin aset referensi. Hadiah hanya kosmetik. Tidak ada hukuman kehilangan streak atau hadiah karena membatasi kalori.

Susunan desktop: sidebar 220px, padding kanvas 32px dan gutter 16px. Mobile: padding 20px, navigasi bawah lima tujuan, menu tambahan untuk riwayat/resep/pengaturan. Quest naik di atas jurnal pada layar kecil. Gerak hanya umpan balik kontrol, dengan dukungan reduced-motion.

Pertanyaan quest: kebiasaan mencatat apa yang sudah selesai dan hadiah apa yang bisa dipakai? Progres dibangun dari catatan server, sedangkan reward hanya mengubah tampilan penjelajah. Tidak ada redraw arah; palet referensi menjadi pengecualian `palette-purple`. Data contoh hanya muncul dalam mode demo yang berlabel; akun baru mulai dari nol. Identitas demo berada di `lib/demo/profile.ts`, sementara makanan, air dan olahraga contoh berada di `lib/demo/nutrition-data.ts`; data akun mengambil server dan tidak perlu mengganti file contoh tersebut.

Verifikasi akhir: pemeriksa tiga lebar 1440/768/390 mencatat 0 FAIL untuk markas, chat dan quest. Markas memiliki 0 WARN; chat memiliki satu peringatan ruang sambutan 48px, quest satu peringatan jumlah warna SVG lanskap (bukan seri chart). Semua screenshot diperiksa; penjelajah pada markas digeser pada tablet/mobile agar tidak menutupi tautan. Pengujian browser memeriksa klaim idempoten, hadiah tersimpan, balasan Ollama nyata, rujukan sumber gizi, percakapan tersimpan dan 13 rute mobile tanpa luapan horizontal. Ini pemeriksaan fungsi dan tampilan, bukan tolok ukur akurasi model.
