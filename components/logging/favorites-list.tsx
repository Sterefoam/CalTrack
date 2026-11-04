"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { formatNumber, sumNutrition } from "@/lib/demo/nutrition-data";
import { createFoodDraft } from "@/lib/logging/food-draft";
import { InputModePicker } from "./input-mode-picker";

export function FavoritesList() {
  const { favorites, removeFavorite, setFoodDraft } = useDashboardState();
  const [query, setQuery] = useState("");
  const router = useRouter();
  const filtered = favorites.filter((favorite) => favorite.items.some((item) => item.foodName.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID"))));
  return <div className="content-wrap logging-page"><header className="page-heading"><h1>Makanan favorit</h1><p>Simpan pilihan yang sering dimakan agar mudah dicatat lagi.</p></header><InputModePicker /><p className="demo-note">Mode demo. Favorit tersimpan selama sesi ini dan akan kosong saat halaman dimuat ulang.</p><label className="field-label mb-6" htmlFor="favorite-query">Cari favorit<input id="favorite-query" className="ui-input w-full" type="search" maxLength={120} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nama makanan favorit" /></label><p className="search-count" role="status">{filtered.length} favorit</p>
    {!filtered.length ? <section className="surface-panel"><h2>{favorites.length ? "Tidak ada favorit yang cocok" : "Belum ada makanan favorit"}</h2><p className="photo-description mt-4">{favorites.length ? "Coba cari nama lain atau hapus pencarian." : "Pilih Simpan ke favorit pada rincian makanan atau hasil tinjauan."}</p><Link className="ui-btn ui-btn-primary" href="/log/search">Cari makanan</Link></section> : <ul className="favorite-list">{filtered.map((favorite) => <li className="surface-panel favorite-row" key={favorite.id}><div><h2>{favorite.items.map((item) => item.foodName).join(", ")}</h2><p>{formatNumber(favorite.items.reduce((sum, item) => sum + item.weightGrams, 0))} gram · {formatNumber(sumNutrition(favorite.items).calories)} kkal · {favorite.items.length} komponen</p></div><div className="text-log-actions"><button className="ui-btn ui-btn-primary" onClick={() => { setFoodDraft({ ...createFoodDraft(favorite.inputMethod, favorite.items), origin: "favorite" }); router.push("/log/review"); }}>Tinjau & catat</button><button className="ui-btn" onClick={() => removeFavorite(favorite.id)} aria-label={`Hapus favorit ${favorite.items.map((item) => item.foodName).join(", ")}`}>Hapus</button></div></li>)}</ul>}
  </div>;
}
