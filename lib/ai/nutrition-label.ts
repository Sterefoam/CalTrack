import { normalizePhoto } from "./photo";
import { requestVisionJson,type VisionOptions } from "./vision-request";
import { nutritionLabelSchema,parseNutritionLabel } from "@/lib/nutrition/label";

export async function analyzeNutritionLabel(file:File,signal:AbortSignal,options?:VisionOptions) {
  const image=await normalizePhoto(file,2400);
  const instruction="Baca tabel informasi nilai gizi pada kemasan dalam bahasa/aksara apa pun yang dapat kamu pahami. " +
    "Deteksi bahasa otomatis dan pertahankan nama baris asli pada label. Terjemahkan key dan satuan hanya ke enum skema. " +
    "Salin value angka yang benar-benar tercetak, termasuk pemisah desimal aslinya; jangan menghitung/mengarang nutrien yang tidak ada. " +
    "Pilih tepat SATU kolom acuan gizi (utamakan per 100 g/ml, bila tidak ada gunakan per porsi). Semua facts harus berasal dari kolom yang sama, jangan mencampur per porsi dengan per 100 g. " +
    "Abaikan kolom % nilai harian sebagai jumlah gram. amount pada basis adalah jumlah acuan kolom terpilih, bukan berat bersih kemasan. " +
    "Bila tabel hanya per porsi tanpa gram/ml, unit=serving dan amount=1. Kolom acuan tidak jelas: unit=unknown, amount=null. " +
    "Energy boleh punya dua facts untuk kcal dan kJ yang tercetak. Natrium berbeda dari garam; jangan mengonversi sendiri. " +
    "Set value=null dan qualifier=unreadable untuk angka buram/hilang. Tanda < harus qualifier=less_than, bukan angka pasti. " +
    "Bila bukan tabel gizi, isNutritionLabel=false. Tuliskan warnings singkat dalam Bahasa Indonesia dan jangan menjamin mendukung semua bahasa atau kondisi foto.";
  return parseNutritionLabel(await requestVisionJson(image,instruction,nutritionLabelSchema,signal,options));
}
