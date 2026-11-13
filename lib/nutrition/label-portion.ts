import type { FoodItem } from "@/lib/demo/nutrition-data";
import { nutritionFields } from "@/lib/logging/food-draft";
import type { LabelNutrientKey } from "./label";

export type LabelPortionInput = {
  productName: string;
  basisAmount: string;
  basisUnit: "g" | "ml" | "serving" | "unknown";
  consumedAmount: string;
  actualGrams: string;
  nutrients: Record<LabelNutrientKey, string>;
  confirmed: boolean;
};
const number = (raw: string) => raw.trim() === "" ? NaN : Number(raw);
export function labelPortionToFood(input: LabelPortionInput): FoodItem {
  const basis = number(input.basisAmount), consumed = number(input.consumedAmount);
  if (!input.confirmed) throw new Error("Cocokkan angka dan kolom acuan dengan kemasan, lalu centang konfirmasi.");
  if (!input.productName.trim() || input.productName.trim().length > 120) throw new Error("Isi nama produk, maksimal 120 karakter.");
  if (!["g", "ml", "serving"].includes(input.basisUnit) || !Number.isFinite(basis) || basis <= 0 || basis > 10000 || !Number.isFinite(consumed) || consumed <= 0 || consumed > 10000) throw new Error("Lengkapi acuan label dan jumlah yang dimakan dengan satuan yang sama.");
  const weightGrams = input.basisUnit === "g" ? consumed : number(input.actualGrams);
  if (!Number.isFinite(weightGrams) || weightGrams < 0.1 || weightGrams > 10000) throw new Error("Isi berat makanan yang dimakan dalam gram. ml atau porsi tidak otomatis sama dengan gram.");
  const item: FoodItem = { foodName: input.productName.trim(), weightGrams, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };
  for (const field of nutritionFields) {
    const amount = number(input.nutrients[field.key]), scaled = amount * consumed / basis;
    if (!Number.isFinite(amount) || amount < 0 || amount > field.max || !Number.isFinite(scaled) || scaled > field.max) throw new Error(`Periksa ${field.label}. Nilai kosong belum berarti nol; isi hanya dari sumber yang kamu ketahui.`);
    item[field.key] = Number(scaled.toPrecision(12));
  }
  return item;
}
