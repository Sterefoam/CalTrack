export type MacroAmounts = {
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type MacroSource = MacroAmounts;

export function aggregateMacros(entries: readonly MacroSource[], target: MacroAmounts = { proteinG: 0, carbsG: 0, fatG: 0 }) {
  const consumed = entries.reduce<MacroAmounts>((sum, entry) => {
    for (const value of [entry.proteinG, entry.carbsG, entry.fatG]) {
      if (!Number.isFinite(value) || value < 0) throw new RangeError("Nilai makronutrisi harus berupa angka positif atau nol.");
    }
    return {
      proteinG: sum.proteinG + entry.proteinG,
      carbsG: sum.carbsG + entry.carbsG,
      fatG: sum.fatG + entry.fatG
    };
  }, { proteinG: 0, carbsG: 0, fatG: 0 });

  for (const value of [target.proteinG, target.carbsG, target.fatG]) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError("Target makronutrisi harus berupa angka positif atau nol.");
  }

  return {
    proteinG: { consumed: consumed.proteinG, target: target.proteinG },
    carbsG: { consumed: consumed.carbsG, target: target.carbsG },
    fatG: { consumed: consumed.fatG, target: target.fatG }
  };
}
