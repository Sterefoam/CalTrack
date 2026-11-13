"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { catalogPortion, type CatalogEntry } from "@/lib/client/catalog";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { createFoodDraft } from "@/lib/logging/food-draft";
import { NutritionSummary } from "./nutrition-summary";
import { ManualLogButton } from "./manual-log-button";
import { InputModePicker } from "./input-mode-picker";

function Portion({ food, method }: { food: CatalogEntry; method: "search" | "barcode" }) {
  const [grams, setGrams] = useState(String(food.servingSizeG || 100));
  const { setFoodDraft } = useDashboardState();
  const router = useRouter();
  const item = grams ? catalogPortion(food, Number(grams)) : null;
  return <section className="surface-panel mt-6"><h2>{food.name}</h2><p className="field-help">{food.brand} · Sumber: {food.source}</p><form className="form-stack mt-4" onSubmit={(event) => { event.preventDefault(); if (!item) return; setFoodDraft({ ...createFoodDraft(method, [item]), origin: "catalog" }); router.push("/log/review"); }}><label className="field-label" htmlFor="account-food-grams">Berat yang dimakan (gram)<input id="account-food-grams" className="ui-input w-full" type="number" min={1} max={10000} step={1} required value={grams} onChange={(e) => setGrams(e.target.value)} /></label>{item ? <NutritionSummary items={[item]} /> : <p role="status">Porsi tidak valid atau nilai gizi belum lengkap. Isi gizi manual bila data produk belum tersedia.</p>}<button className="ui-btn ui-btn-primary" disabled={!item}>Tinjau makanan</button></form></section>;
}

export function AccountCatalog({ barcode = false }: { barcode?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const text = barcode ? query.replace(/[\s-]/g, "") : query.trim();
    if (barcode ? !/^(?:\d{8}|\d{12,14})$/.test(text) : text.length < 2) { setError(barcode ? "Masukkan 8, 12, 13, atau 14 digit barcode." : "Tulis minimal dua karakter."); return; }
    const run = new AbortController(); controller.current = run;
    setBusy(true); setError(""); setNotice(""); setSelected(null); setResults([]);
    try {
      if (barcode) {
        const result = await api<{ status: "found" | "not_found" | "incomplete"; food?: CatalogEntry }>(`/api/foods/barcode/${text}`, { signal: run.signal });
        if (result.status === "found" && result.food) setSelected(result.food);
        else setNotice(result.status === "incomplete" ? "Produk ditemukan tetapi gizinya belum lengkap. Gunakan label kemasan untuk mengisi manual." : "Produk belum ditemukan. Periksa kode atau isi gizi manual.");
      } else {
        const result = await api<{ foods: CatalogEntry[] }>(`/api/foods?${new URLSearchParams({ q: text, limit: "50" })}`, { signal: run.signal });
        setResults(result.foods); setNotice(`${result.foods.length} hasil${result.foods.length === 50 ? " pertama; perjelas pencarian untuk hasil lainnya" : ""}`);
      }
    } catch (cause) { if (!run.signal.aborted) setError(cause instanceof Error ? cause.message : "Pencarian gagal."); }
    finally { if (!run.signal.aborted) setBusy(false); }
  }
  const content = <><p className="demo-note">{barcode ? "Masukkan barcode produk kemasan untuk mencari data Open Food Facts. Tinjau data kemasan dan porsinya sebelum dicatat." : "Cari pada katalog server. Nilai gizi dinormalisasi per 100 gram; data tidak lengkap perlu dilengkapi manual."}</p><section className="surface-panel"><form className="form-stack" onSubmit={search}><label className="field-label" htmlFor="account-food-query">{barcode ? "Kode barcode" : "Nama makanan"}<input id="account-food-query" className="ui-input w-full" required maxLength={barcode ? 32 : 120} inputMode={barcode ? "numeric" : "text"} value={query} onChange={(e) => setQuery(e.target.value)} /></label><button className="ui-btn" disabled={busy}>{busy ? "Mencari..." : "Cari"}</button></form>{error && <p className="ui-alert ui-alert-error mt-4" role="alert">{error}</p>}{notice && <p className="mt-4" role="status">{notice}</p>}{!!results.length && <ul className="ui-list mt-4">{results.map((food) => <li className="ui-list-row" key={food.id}><button className="ui-btn ui-btn-ghost h-auto min-h-11 text-left justify-start" onClick={() => setSelected(food)} aria-pressed={selected?.id === food.id}>{food.name}{food.brand ? ` · ${food.brand}` : ""}</button></li>)}</ul>}<div className="mt-5"><ManualLogButton /></div></section>{selected && <Portion key={selected.id} food={selected} method={barcode ? "barcode" : "search"} />}</>;
  return barcode ? content : <div className="content-wrap logging-page"><header className="page-heading"><h1>Cari makanan</h1><p>Temukan makanan dan sesuaikan porsinya.</p></header><InputModePicker />{content}</div>;
}
