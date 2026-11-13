# Resep dan gizi

Migrasi `0007_recipes` menambah `recipes`, `recipe_ingredients`, dan `recipe_steps`.
Kalori serta makro dihitung per satu porsi. `serving_weight_g`, serat, gula, dan natrium
boleh NULL untuk membedakan belum diketahui dari nol. Sumber `example` menandai konten
contoh; `curated` disediakan untuk data yang telah ditinjau. Kolom sumber bukan sertifikasi
akurasi gizi. Bahan dan instruksi memiliki urutan unik per resep dan dihapus bersama resep.

Jalankan migrasi aplikasi sebelum memakai tabel baru. Uji database sementara mencakup
nilai gizi tidak diketahui, penolakan nilai negatif, urutan unik, serta penghapusan anak.

Migrasi `0008_recipe_favorites` menautkan akun dengan resep. Pasangan pengguna/resep unik;
penghapusan akun hanya menghapus favoritnya, sedangkan resep koleksi tetap tersedia.
Menghapus resep membersihkan seluruh referensi favorit resep tersebut.

`GET /api/recipes` membutuhkan sesi akun dan menghitung sisa kalori hari ini dari server,
termasuk olahraga. Hanya resep dengan kalori per porsi tidak melebihi sisa tersebut yang
dikembalikan. Tanpa target atau jika sisa <= 0, daftar kosong disertai `hasTarget` dan
`remainingCalories`; ini bukan arahan untuk melewatkan makan. Query mendukung `timeZone`,
`mealType`, `q`, `limit` 1–50 dan `cursor` ID. Urutan ID stabil, respons `nextCursor`
menandai halaman berikutnya. Parameter sisa kalori dari klien tidak dipakai.
Koleksi kosong menghasilkan daftar kosong; endpoint tidak menyisipkan resep demo otomatis.

`PUT /api/recipes/[id]/favorite` menyimpan favorit secara idempoten; resep yang tidak ada
menghasilkan 404. `DELETE` pada route yang sama menghapus favorit akun sendiri secara
idempoten (204). `GET /api/recipes/favorites` mengembalikan koleksi favorit akun dengan
`limit`/`cursor`. Favorit tidak dibatasi sisa kalori dan tidak mencatat konsumsi.

`POST /api/recipes/[id]/log` menerima `portions` (0,1–20), `weightGrams` aktual,
`mealType` dan `loggedAt` opsional. Kalori/makro dihitung ulang dari resep server.
Jika serat/gula/natrium resep NULL, pengguna harus mengonfirmasi `fiberG`, `sugarG`,
`sodiumMg` yang hilang untuk total porsi yang dimakan; tanpa nilai tersebut respons 422
`recipe_nutrition_confirmation_required` dan tidak ada log. Nilai mikro resep yang sudah
diketahui dihitung dari jumlah porsi. Catatan menyimpan snapshot dan penanda estimasi,
sehingga perubahan resep berikutnya tidak mengubah riwayat konsumsi.
