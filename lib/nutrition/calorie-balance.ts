export type CalorieBalanceInput = {
  targetCalories: number;
  consumedCalories: number;
  exerciseCalories: number;
};

export function calculateRemainingCalories({ targetCalories, consumedCalories, exerciseCalories }: CalorieBalanceInput): number {
  const values = [targetCalories, consumedCalories, exerciseCalories];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("Nilai kalori harus berupa angka positif atau nol.");
  }

  return targetCalories - consumedCalories + exerciseCalories;
}
