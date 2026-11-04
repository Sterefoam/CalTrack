"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { mealLabels, type MealType } from "@/lib/demo/nutrition-data";
import { createFoodDraft } from "@/lib/logging/food-draft";
import { analyzeFoodText } from "@/lib/logging/text-analysis-client";
import { InputModePicker } from "./input-mode-picker";

const example = "Makan siang nasi putih 200 gram, ayam panggang 100 gram, dan sayur tumis 100 gram.";

export function TextLog() {
  const { textDraft, setTextDraft, setFoodDraft } = useDashboardState();
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (textDraft.trim().length < 3 || busy) return;
    const run = new AbortController();
    controller.current = run;
    setBusy(true); setError("");
    try {
      const result = await analyzeFoodText({ text: textDraft, mealType }, run.signal);
      if (run.signal.aborted) return;
      setFoodDraft({ ...createFoodDraft("text", result.items, result.confidenceScore), mealType, notes: textDraft.trim() });
      router.push("/log/review");
    } catch (cause) {
      if (!run.signal.aborted) setError(cause instanceof Error ? cause.message : "Hasil belum berhasil disiapkan. Coba lagi.");
    } finally { if (!run.signal.aborted) setBusy(false); }
  }
  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>Ceritakan makananmu</h1><p>Tulis apa yang kamu makan beserta perkiraan porsinya.</p></header>
    <InputModePicker />
    <p className="demo-note">Mode demo. Teks belum dianalisis AI. Hasil simulasi selalu memakai contoh nasi, ayam, dan sayur; kamu dapat mengeditnya saat meninjau.</p>
    <section className="surface-panel text-log-panel"><h2>Catatan lewat teks</h2><form className="form-stack mt-6" onSubmit={submit}>
      <label className="field-label" htmlFor="text-meal">Waktu makan<select id="text-meal" className="ui-select w-full" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} disabled={busy}>{Object.entries(mealLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      <label className="field-label" htmlFor="food-text">Apa yang kamu makan?<textarea id="food-text" className="ui-textarea w-full" rows={6} required minLength={3} maxLength={1000} value={textDraft} onChange={(e) => setTextDraft(e.target.value)} placeholder={example} aria-describedby="food-text-help" disabled={busy} /></label>
      <p className="text-log-help" id="food-text-help">Sebutkan nama makanan, jumlah, dan cara memasak jika tahu. {textDraft.length}/1.000 karakter.</p>
      <div className="text-log-actions"><button className="ui-btn" type="button" onClick={() => setTextDraft(example)} disabled={busy}>Gunakan contoh</button><button className="ui-btn ui-btn-ghost" type="button" disabled={!textDraft || busy} onClick={() => setTextDraft("")}>Kosongkan</button></div>
      {error && <p className="ui-alert ui-alert-error" role="alert">{error}</p>}
      {busy ? <><p role="status">Menyiapkan hasil contoh...</p><button className="ui-btn" type="button" onClick={() => { controller.current?.abort(); setBusy(false); }}>Batalkan</button></> : <button className="ui-btn ui-btn-primary" type="submit" disabled={textDraft.trim().length < 3}>Tinjau hasil contoh</button>}
    </form></section>
  </div>;
}
