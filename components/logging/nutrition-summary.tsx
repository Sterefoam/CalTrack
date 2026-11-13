"use client";

import { useState } from "react";
import { formatNumber, sumNutrition, type FoodItem } from "@/lib/demo/nutrition-data";
import { nutritionFields } from "@/lib/logging/food-draft";

export function NutritionSummary({ items, confidenceScore = null, demo = true }: { items: FoodItem[]; confidenceScore?: number | null; demo?: boolean }) {
  const [basis, setBasis] = useState<"portion" | "100g">("portion");
  const totals = sumNutrition(items);
  const totalGrams = items.reduce((sum, item) => sum + item.weightGrams, 0);
  const factor = basis === "100g" && totalGrams > 0 ? 100 / totalGrams : 1;
  const macroCalories = totals.proteinG * 4 + totals.carbsG * 4 + totals.fatG * 9;
  const series = [
    { label: "Protein", value: totals.proteinG * 4, className: "protein" },
    { label: "Karbohidrat", value: totals.carbsG * 4, className: "carbs" },
    { label: "Lemak", value: totals.fatG * 9, className: "fat" },
  ];
  const rawShares = series.map((entry) => macroCalories ? entry.value / macroCalories * 100 : 0);
  const shares = rawShares.map(Math.floor);
  const order = rawShares.map((value, index) => ({ index, fraction: value - shares[index] })).sort((a, b) => b.fraction - a.fraction);
  const remaining = macroCalories ? 100 - shares.reduce((sum, value) => sum + value, 0) : 0;
  for (let index = 0; index < remaining; index++) shares[order[index % order.length].index]++;
  const composition = series.map((entry, index) => `${entry.label} ${shares[index]} persen`).join(", ");

  return <div className="nutrition-summary">
    <div className="basis-switch" role="group" aria-label="Dasar perhitungan nutrisi"><button className="ui-btn ui-btn-ghost" type="button" aria-pressed={basis === "portion"} onClick={() => setBasis("portion")}>Hidangan ini</button><button className="ui-btn ui-btn-ghost" type="button" aria-pressed={basis === "100g"} disabled={totalGrams <= 0} onClick={() => setBasis("100g")}>Per 100 g</button></div>
    <p className="target-number">{formatNumber(totals.calories * factor)} <span>kkal</span></p>
    <p className="nutrition-basis-label">{basis === "portion" ? `${items.length} komponen · ${formatNumber(totalGrams)} g total` : "Nilai setara untuk 100 g hidangan"}</p>
    <section className="macro-composition" aria-label="Komposisi energi dari makronutrisi"><h3>Energi dari makro</h3><div className="macro-stacked-bar" role="img" aria-label={macroCalories ? composition : "Belum ada energi makronutrisi"}>{series.map((entry, index) => <span key={entry.label} className={entry.className} style={{ width: `${shares[index]}%` }} />)}</div><ul className="macro-composition-legend">{series.map((entry, index) => <li key={entry.label}><span className={`legend-dot ${entry.className}`} aria-hidden="true" />{entry.label}<strong>{shares[index]}%</strong></li>)}</ul></section>
    <dl className="nutrition-facts">{nutritionFields.filter((field) => field.key !== "calories").map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{formatNumber(totals[field.key] * factor)} {field.unit}</dd></div>)}</dl>
    {confidenceScore !== null && <div className="confidence-summary"><div><span>{demo ? "Keyakinan deteksi contoh" : "Keyakinan deteksi AI"}</span><strong>{Math.round(confidenceScore * 100)}%</strong></div><progress className="ui-progress w-full" aria-label={demo ? "Skor keyakinan deteksi contoh" : "Skor keyakinan deteksi AI"} max={100} value={Math.round(confidenceScore * 100)} /><p>Estimasi perlu diperiksa; skor keyakinan bukan jaminan ketepatan gizi.</p></div>}
  </div>;
}
