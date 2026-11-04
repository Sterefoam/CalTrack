import type { FoodItem } from "./nutrition-data";

export type CatalogFood = { id: string; category: "Makanan pokok" | "Lauk" | "Buah & sayur"; aliases: string; item: FoodItem };

// Nilai contoh per 100 gram untuk menguji alur pencarian, bukan database pangan.
export const foodCatalog: CatalogFood[] = [
  { id: "rice", category: "Makanan pokok", aliases: "nasi beras", item: { foodName: "Nasi putih", weightGrams: 100, calories: 130, proteinG: 2.5, carbsG: 28, fatG: 0.3, fiberG: 0.4, sugarG: 0.1, sodiumMg: 1 } },
  { id: "oats", category: "Makanan pokok", aliases: "oat havermut bubur", item: { foodName: "Oatmeal matang", weightGrams: 100, calories: 71, proteinG: 2.5, carbsG: 12, fatG: 1.5, fiberG: 1.7, sugarG: 0.3, sodiumMg: 4 } },
  { id: "chicken", category: "Lauk", aliases: "ayam dada panggang", item: { foodName: "Dada ayam panggang", weightGrams: 100, calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0, sugarG: 0, sodiumMg: 74 } },
  { id: "egg", category: "Lauk", aliases: "telur rebus", item: { foodName: "Telur rebus", weightGrams: 100, calories: 155, proteinG: 13, carbsG: 1.1, fatG: 11, fiberG: 0, sugarG: 1.1, sodiumMg: 124 } },
  { id: "tempeh", category: "Lauk", aliases: "tempe kedelai", item: { foodName: "Tempe kukus", weightGrams: 100, calories: 193, proteinG: 20, carbsG: 7.6, fatG: 11, fiberG: 3.9, sugarG: 0.5, sodiumMg: 9 } },
  { id: "banana", category: "Buah & sayur", aliases: "pisang banana", item: { foodName: "Pisang", weightGrams: 100, calories: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, fiberG: 2.6, sugarG: 12, sodiumMg: 1 } },
  { id: "apple", category: "Buah & sayur", aliases: "apel apple", item: { foodName: "Apel dengan kulit", weightGrams: 100, calories: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2, fiberG: 2.4, sugarG: 10, sodiumMg: 1 } },
  { id: "broccoli", category: "Buah & sayur", aliases: "brokoli broccoli sayur", item: { foodName: "Brokoli kukus", weightGrams: 100, calories: 35, proteinG: 2.4, carbsG: 7.2, fatG: 0.4, fiberG: 3.3, sugarG: 1.4, sodiumMg: 41 } },
];

export function scaleCatalogFood(food: CatalogFood, grams: number): FoodItem {
  return Object.fromEntries(Object.entries(food.item).map(([key, value]) => [key, key === "foodName" ? value : key === "weightGrams" ? grams : Math.round(Number(value) * grams / food.item.weightGrams * 10) / 10])) as FoodItem;
}
