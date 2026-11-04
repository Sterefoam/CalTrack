import type { FoodItem } from "@/lib/demo/nutrition-data";
import type { InputMethod } from "./food-draft";

export type FavoriteFood = { id: string; inputMethod: InputMethod; items: FoodItem[] };

export function sameFoodItems(a: FoodItem[], b: FoodItem[]) {
  return a.length === b.length && a.every((item, index) => (Object.keys(item) as (keyof FoodItem)[]).every((key) => item[key] === b[index][key]));
}
