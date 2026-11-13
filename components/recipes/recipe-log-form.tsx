"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/lib/demo/recipes";
import { mealLabels, formatNumber, type MealType } from "@/lib/demo/nutrition-data";
import { createFoodDraft } from "@/lib/logging/food-draft";
import { useDashboardState } from "@/components/dashboard/dashboard-state";

export function RecipeLogForm({ recipe }: { recipe: Recipe }) {
  const { setFoodDraft } = useDashboardState();
  const router = useRouter();
  const [portions, setPortions] = useState("1");
  const [grams, setGrams] = useState("");
  const [mealType, setMealType] = useState<MealType>(recipe.meal === "Sarapan" ? "breakfast" : recipe.meal === "Makan siang" ? "lunch" : "dinner");
  const factor = Number(portions);
  const validPortions = portions !== "" && Number.isFinite(factor) && factor >= 0.25 && factor <= 10;
  const valid = validPortions && grams !== "" && Number.isFinite(Number(grams)) && Number(grams) >= 1 && Number(grams) <= 10000;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    const scaled = (value: number) => Math.round(value * factor * 10) / 10;
    const draft = createFoodDraft("search", [{ foodName: recipe.name, weightGrams: Number(grams), calories: scaled(recipe.calories), proteinG: scaled(recipe.proteinG), carbsG: scaled(recipe.carbsG), fatG: scaled(recipe.fatG), fiberG: 0, sugarG: 0, sodiumMg: 0 }]);
    draft.origin = "recipe";
    draft.mealType = mealType;
    setFoodDraft(draft);
    router.push("/log/review");
  }
  return <section className="surface-panel mt-6" aria-labelledby="recipe-log-title"><h2 id="recipe-log-title">Catat resep untuk hari ini</h2>
    <p className="photo-description">Sesuaikan porsi yang dimakan. Serat, gula, dan natrium belum tersedia; lengkapi pada langkah tinjauan sebelum menyimpan.</p>
    <form onSubmit={submit} className="form-stack mt-5">
      <div className="field-grid"><label className="field-label" htmlFor="recipe-portions">Jumlah porsi<input id="recipe-portions" className="ui-input w-full" type="number" min={0.25} max={10} step={0.25} required value={portions} onChange={(e) => setPortions(e.target.value)} /></label>
      <label className="field-label" htmlFor="recipe-grams">Berat yang dimakan (gram)<input id="recipe-grams" className="ui-input w-full" type="number" min={1} max={10000} step={1} required value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
      <label className="field-label" htmlFor="recipe-meal">Waktu makan<select id="recipe-meal" className="ui-select w-full" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>{Object.entries(mealLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <p className="tabular-nums" role="status">{validPortions ? `Estimasi ${formatNumber(recipe.calories * factor)} kkal untuk ${formatNumber(factor)} porsi` : "Masukkan 0,25–10 porsi."}</p>
      <button type="submit" className="ui-btn ui-btn-primary self-start" disabled={!valid}>Tinjau sebelum mencatat</button>
    </form>
  </section>;
}
