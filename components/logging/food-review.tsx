"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { mealLabels, type FoodItem, type MealType } from "@/lib/demo/nutrition-data";
import { nutritionFields, type FoodDraft } from "@/lib/logging/food-draft";
import { NutritionSummary } from "./nutrition-summary";
import { FavoriteButton } from "./favorite-button";

type Values = { [K in keyof FoodItem]: string };
type Row = { id: string; values: Values; reference: FoodItem };
const toRow = (item: FoodItem): Row => ({ id: crypto.randomUUID(), values: Object.fromEntries(Object.entries(item).map(([key, value]) => [key, String(value)])) as Values, reference: { ...item } });
const toItem = (row: Row): FoodItem => Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, key === "foodName" ? value.trim() : Number(value)])) as FoodItem;
const blankItem: FoodItem = { foodName: "", weightGrams: 100, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };

export function FoodReview() {
  const { foodDraft, setFoodDraft, saveFoodLog } = useDashboardState();
  const router = useRouter();
  if (!foodDraft) return <div className="content-wrap logging-page"><header className="page-heading"><h1>Belum ada hasil untuk ditinjau</h1><p>Pilih cara mencatat makanan untuk memulai.</p></header><Link className="ui-btn ui-btn-primary" href="/log">Catat makanan</Link></div>;
  return <ReviewEditor key={foodDraft.id} draft={foodDraft} onApply={setFoodDraft} onSave={(draft) => { saveFoodLog(draft); router.push("/"); }} />;
}

function ReviewEditor({ draft, onApply, onSave }: { draft: FoodDraft; onApply: (value: FoodDraft) => void; onSave: (value: FoodDraft) => void }) {
  function makeRows(items: FoodItem[]) {
    return items.map((item) => { const row = toRow(item); if (draft.origin === "manual" && !item.foodName) for (const field of nutritionFields) row.values[field.key] = ""; return row; });
  }
  const original = useRef(draft.items);
  const [rows, setRows] = useState(() => makeRows(draft.items));
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [mealType, setMealType] = useState<MealType>(draft.mealType);
  const items = rows.map(toItem);
  const sources = {
    search: { href: "/log/search", label: "pencarian", note: "Pilihan dari katalog contoh. Tinjau kembali nama, porsi, dan nilai gizinya." },
    text: { href: "/log/text", label: "teks", note: "Hasil simulasi memakai hidangan contoh, belum berasal dari analisis teksmu." },
    voice: { href: "/log/voice", label: "rekaman", note: "Hasil simulasi memakai hidangan contoh, belum berasal dari isi rekamanmu." },
    barcode: { href: "/log/barcode", label: "barcode", note: "Produk tiruan untuk mencoba alur barcode. Nilai gizi ini belum berasal dari kemasanmu." },
    photo: { href: "/log/photo", label: "foto", note: "Hasil contoh untuk mencoba alur. Nama dan nilai gizi ini belum berasal dari analisis fotomu." },
  };
  const source = draft.origin === "favorite" ? { href: "/log/favorites", label: "favorit", note: "Makanan dari favorit sesi demo. Tinjau porsi dan nilai gizinya sebelum dicatat." } : draft.origin === "manual" ? { href: "/log/barcode", label: "barcode", note: "Isi nilai gizi sesuai porsi pada label kemasan. Masukkan 0 bila label menyatakan nol. Catatan disimpan untuk sesi demo ini." } : sources[draft.inputMethod];
  const valid = rows.every((row) => row.values.foodName.trim() && Number(row.values.weightGrams) >= 0.1 && Number(row.values.weightGrams) <= 10000 && nutritionFields.every((field) => row.values[field.key] !== "" && Number.isFinite(Number(row.values[field.key])) && Number(row.values[field.key]) >= 0 && Number(row.values[field.key]) <= field.max));

  function update(id: string, key: keyof FoodItem, value: string) {
    setApplied(false);
    setError("");
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const values = { ...row.values, [key]: value };
      const reference = { ...row.reference };
      if (key === "weightGrams" && Number(value) > 0) {
        for (const field of nutritionFields) if (row.values[field.key] !== "") values[field.key] = String(Math.round(reference[field.key] * Number(value) / reference.weightGrams * 10) / 10);
      } else if (key !== "foodName" && key !== "weightGrams" && value !== "" && Number(row.values.weightGrams) > 0) {
        reference[key] = Number(value) * reference.weightGrams / Number(row.values.weightGrams);
      }
      return { ...row, values, reference };
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || rows.length < 1) { setError("Periksa nama, porsi, dan nilai gizi setiap makanan."); return; }
    const updated = { ...draft, mealType, items };
    if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-save") === "true") { onSave(updated); return; }
    onApply(updated);
    setApplied(true);
  }

  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>{draft.origin === "manual" ? "Catat gizi manual" : "Tinjau makanan"}</h1><p>Sesuaikan isi hidangan dan porsi sebelum dicatat.</p></header>
    <p className="demo-note">{source.note}{draft.confidenceScore !== null && ` Skor keyakinan contoh: ${Math.round(draft.confidenceScore * 100)}%.`}</p>
    {draft.inputMethod === "text" && draft.notes && <details className="source-text"><summary>Teks yang kamu tulis</summary><p>{draft.notes}</p></details>}
    <form className="review-grid" onSubmit={submit}>
      <div className="review-items">
        <section className="surface-panel"><label className="field-label" htmlFor="review-meal">Waktu makan<select id="review-meal" className="ui-select w-full" value={mealType} onChange={(e) => { setMealType(e.target.value as MealType); setApplied(false); }}>{Object.entries(mealLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><p className="photo-description mt-4">Catatan ditambahkan untuk hari ini.</p></section>
        {rows.map((row, index) => <section className="surface-panel review-item" key={row.id}>
          <div className="review-item-heading"><h2>Makanan {index + 1}</h2><button className="ui-btn ui-btn-ghost" type="button" aria-label={`Hapus makanan ${index + 1}`} disabled={rows.length === 1} onClick={() => { setRows((current) => current.filter((item) => item.id !== row.id)); setApplied(false); }}>Hapus</button></div>
          <div className="form-stack"><label className="field-label" htmlFor={`${row.id}-name`}>Nama makanan<input id={`${row.id}-name`} className="ui-input w-full" required maxLength={120} value={row.values.foodName} onChange={(e) => update(row.id, "foodName", e.target.value)} /></label><label className="field-label" htmlFor={`${row.id}-grams`}>Porsi (gram)<input id={`${row.id}-grams`} className="ui-input w-full" type="number" min={0.1} max={10000} step={0.1} required value={row.values.weightGrams} onChange={(e) => update(row.id, "weightGrams", e.target.value)} aria-describedby={`${row.id}-portion-help`} /></label><p className="field-help" id={`${row.id}-portion-help`}>Nilai gizi ikut berubah saat porsi diubah.</p></div>
          <details className="nutrition-details" open={index === 0}><summary>Edit nilai gizi</summary><div className="field-grid">{nutritionFields.map((field) => <label key={field.key} className="field-label" htmlFor={`${row.id}-${field.key}`}>{field.label} ({field.unit})<input id={`${row.id}-${field.key}`} className="ui-input w-full" type="number" min={0} max={field.max} step={0.1} required value={row.values[field.key]} onChange={(e) => update(row.id, field.key, e.target.value)} /></label>)}</div></details>
        </section>)}
        <button className="ui-btn w-full" type="button" disabled={rows.length >= 20} onClick={() => { setRows((current) => [...current, toRow(blankItem)]); setApplied(false); }}>Tambah komponen makanan</button>
      </div>
      <aside className="surface-panel review-summary"><h2>Total hidangan</h2>{valid ? <NutritionSummary items={items} confidenceScore={draft.confidenceScore} /> : <p className="photo-description">Lengkapi nama, porsi, dan nilai gizi untuk melihat total.</p>}
        {error && <p className="ui-alert ui-alert-error mt-4" role="alert">{error}</p>}
        {applied && <p className="ui-alert ui-alert-success mt-4" role="status">Perubahan diterapkan pada hasil tinjauan.</p>}
        {valid && <FavoriteButton items={items} inputMethod={draft.inputMethod} />}
        <div className="form-stack mt-6"><button className="ui-btn ui-btn-primary" type="submit" data-save="true">Simpan catatan demo</button><button className="ui-btn" type="submit">Terapkan perubahan</button><button className="ui-btn" type="button" onClick={() => { setRows(makeRows(original.current)); setMealType(draft.mealType); setApplied(false); setError(""); }}>Atur ulang perubahan</button><Link className="ui-btn ui-btn-ghost" href={source.href}>Kembali ke {source.label}</Link></div>
      </aside>
    </form>
  </div>;
}
