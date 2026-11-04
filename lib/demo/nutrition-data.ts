export type FoodItem = {
  foodName: string;
  weightGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export const mealLabels = { breakfast: "Sarapan", lunch: "Makan siang", dinner: "Makan malam", snack: "Camilan" };
export type MealType = keyof typeof mealLabels;
export type DemoFoodLog = { id: string; mealType: MealType; time: string; date?: string; items: FoodItem[] };
export const demoTargets = { calories: 2250, proteinG: 120, carbsG: 250, fatG: 70, waterMl: 2500 };
export const demoFoodLogs: DemoFoodLog[] = [
  { id: "demo-breakfast", mealType: "breakfast", time: "08:15", items: [{ foodName: "Oatmeal pisang & madu", weightGrams: 320, calories: 385, proteinG: 13, carbsG: 64, fatG: 11, fiberG: 7, sugarG: 18, sodiumMg: 90 }] },
  { id: "demo-lunch", mealType: "lunch", time: "12:40", items: [{ foodName: "Nasi ayam panggang", weightGrams: 400, calories: 620, proteinG: 42, carbsG: 45, fatG: 26, fiberG: 4, sugarG: 5, sodiumMg: 650 }] },
  { id: "demo-snack", mealType: "snack", time: "15:20", items: [{ foodName: "Greek yogurt & beri", weightGrams: 150, calories: 165, proteinG: 19, carbsG: 12, fatG: 2, fiberG: 2, sugarG: 9, sodiumMg: 65 }] },
];

export function sumNutrition(items: readonly FoodItem[]) {
  return items.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    proteinG: sum.proteinG + item.proteinG,
    carbsG: sum.carbsG + item.carbsG,
    fatG: sum.fatG + item.fatG,
    fiberG: sum.fiberG + item.fiberG,
    sugarG: sum.sugarG + item.sugarG,
    sodiumMg: sum.sodiumMg + item.sodiumMg,
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 });
}

export const formatNumber = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
