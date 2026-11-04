import type { FoodItem } from "./nutrition-data";

export const demoBarcodeProduct: { barcode: string; brand: string; item: FoodItem } = {
  barcode: "2000000000015",
  brand: "Produk demo CalTrack",
  item: { foodName: "Granola oat contoh", weightGrams: 40, calories: 180, proteinG: 4, carbsG: 25.6, fatG: 6.8, fiberG: 3.6, sugarG: 7.2, sodiumMg: 40 },
};

export function barcodePortion(servings: number): FoodItem {
  return Object.fromEntries(Object.entries(demoBarcodeProduct.item).map(([key, value]) => [key, key === "foodName" ? value : Math.round(Number(value) * servings * 10) / 10])) as FoodItem;
}
