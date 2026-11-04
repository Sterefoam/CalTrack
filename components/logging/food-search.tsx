"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { foodCatalog, scaleCatalogFood, type CatalogFood } from "@/lib/demo/food-catalog";
import { createFoodDraft } from "@/lib/logging/food-draft";
import { formatNumber } from "@/lib/demo/nutrition-data";
import { NutritionSummary } from "./nutrition-summary";
import { InputModePicker } from "./input-mode-picker";
import { FavoriteButton } from "./favorite-button";

export function FoodSearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua kategori");
  const [selected, setSelected] = useState<CatalogFood | null>(null);
  const [grams, setGrams] = useState("100");
  const { setFoodDraft } = useDashboardState();
  const router = useRouter();
  const terms = query.trim().toLocaleLowerCase("id-ID").split(/\s+/).filter(Boolean);
  const results = foodCatalog.filter((food) => (category === "Semua kategori" || food.category === category) && terms.every((term) => `${food.item.foodName} ${food.aliases}`.toLocaleLowerCase("id-ID").includes(term)));
  const valid = grams !== "" && Number.isFinite(Number(grams)) && Number(grams) >= 1 && Number(grams) <= 1000;
  const item = selected && valid ? scaleCatalogFood(selected, Number(grams)) : null;

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    setFoodDraft(createFoodDraft("search", [item]));
    router.push("/log/review");
  }

  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>Cari makanan</h1><p>Temukan makanan, sesuaikan porsinya, lalu tinjau nilai gizinya.</p></header>
    <InputModePicker />
    <p className="demo-note">Katalog contoh berisi 8 makanan. Nilai gizi adalah data tiruan untuk mencoba alur pencatatan.</p>
    <div className="search-filters"><label className="field-label" htmlFor="food-query">Nama makanan<input id="food-query" className="ui-input w-full" type="search" maxLength={120} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Misalnya nasi, ayam, atau pisang" /></label><label className="field-label" htmlFor="food-category">Kategori<select id="food-category" className="ui-select w-full" value={category} onChange={(e) => setCategory(e.target.value)}>{["Semua kategori", "Makanan pokok", "Lauk", "Buah & sayur"].map((value) => <option key={value}>{value}</option>)}</select></label></div>
    <div className={`food-search-grid${selected ? " has-selection" : ""}`}>
      <section className="surface-panel"><h2>Hasil pencarian</h2><p className="search-count" role="status">{results.length} makanan · nilai gizi per 100 g</p>
        {results.length ? <ul className="food-result-list">{results.map((food) => <li key={food.id}><button className="food-result" aria-pressed={selected?.id === food.id} onClick={() => { setSelected(food); setGrams("100"); }}><span><strong>{food.item.foodName}</strong><small>{food.category} · Protein {formatNumber(food.item.proteinG)} g</small></span><span><strong>{formatNumber(food.item.calories)} kkal</strong><small>{selected?.id === food.id ? "Dipilih" : "Pilih makanan"}</small></span></button></li>)}</ul> : <div className="search-empty"><p>Tidak ada makanan yang cocok.</p><button className="ui-btn" onClick={() => { setQuery(""); setCategory("Semua kategori"); }}>Hapus filter</button></div>}
      </section>
      {selected && <section className="surface-panel search-portion"><h2>{selected.item.foodName}</h2><form onSubmit={review}><label className="field-label mt-6" htmlFor="search-grams">Porsi (gram)<input id="search-grams" className="ui-input w-full" type="number" min={1} max={1000} step={1} required value={grams} onChange={(e) => setGrams(e.target.value)} aria-describedby="search-portion-help" /></label><p className="photo-description" id="search-portion-help">1–1.000 gram. Nilai gizi menyesuaikan porsi.</p>{item ? <><NutritionSummary items={[item]} /><FavoriteButton items={[item]} inputMethod="search" /></> : <p role="status">Isi porsi yang valid untuk melihat nilai gizi.</p>}<button className="ui-btn ui-btn-primary w-full mt-6" type="submit" disabled={!valid}>Tinjau makanan</button></form></section>}
    </div>
  </div>;
}
