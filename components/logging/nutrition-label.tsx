"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { api } from "@/lib/client/api";
import { createFoodDraft, nutritionFields } from "@/lib/logging/food-draft";
import type { NutritionLabelResult } from "@/lib/nutrition/label";
import { labelPortionToFood, type LabelPortionInput } from "@/lib/nutrition/label-portion";
import { labelLanguages, type LabelLanguage } from "@/lib/nutrition/label-languages";

const sample: NutritionLabelResult = {
  productName: "Produk contoh", languages: ["Indonesia", "English"],
  basis: { amount: 100, unit: "g", description: "Per 100 g / per 100 g" },
  nutrients: { calories: 200, proteinG: 5, carbsG: 30, fatG: 7, fiberG: null, sugarG: 10, sodiumMg: 120 },
  facts: [{ key: "energy", label: "Energi / Energy", value: "200", unit: "kcal", qualifier: "exact" }],
  warnings: ["Data contoh untuk mencoba alur. Serat sengaja kosong agar kamu dapat meninjau nilai yang belum diketahui."],
  confidenceScore: 0, requiresConfirmation: true,
};

export function NutritionLabelCapture() {
  const { mode } = useDashboardState();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<NutritionLabelResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState<"auto" | LabelLanguage>("auto");
  const run = useRef<AbortController | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  useEffect(() => () => run.current?.abort(), []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(next?: File) {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size === 0 || next.size > 4 * 1024 * 1024) { setError("Pilih foto JPG, PNG, atau WebP, lebih dari 0 dan maksimal 4 MB."); return; }
    run.current?.abort(); setBusy(false); setError(""); setResult(null); setFile(next);
  }
  async function scan() {
    if (mode === "demo") { setResult(structuredClone(sample)); setError(""); return; }
    if (!file || busy) return;
    run.current?.abort(); const controller = new AbortController(); run.current = controller;
    setBusy(true); setError(""); setResult(null);
    try {
      const body = new FormData(); body.set("photo", file); body.set("language", language);
      const response = await api<NutritionLabelResult>("/api/analyze/label", { method: "POST", body, signal: controller.signal });
      if (!controller.signal.aborted) setResult(response);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Label belum terbaca. Coba lagi."); }
    finally { if (run.current === controller) setBusy(false); }
  }
  return <div className="space-y-6">
    <section className="surface-panel space-y-4" aria-label="Foto tabel nutrisi">
      <h2 className="text-lg font-semibold">Tampilkan tabel secara utuh</h2>
      <p className="text-sm leading-relaxed text-base-content/70">Gunakan cahaya cukup, tanpa pantulan, dan dekatkan kamera agar angka terbaca. Pilih bahasa pada label atau deteksi otomatis dengan AI. Pembaca lokal masih percobaan; label Arab, Hindi, foto kecil, dan tabel melengkung dapat gagal terbaca. Cocokkan hasil dengan kemasan.</p>
      {mode === "demo" && <p className="demo-note">Mode demo memakai data contoh. Foto tidak dianalisis atau dikirim ke layanan AI.</p>}
      {mode === "account" && <label className="field-label" htmlFor="label-language">Bahasa pada label<select id="label-language" className="ui-select w-full" value={language} onChange={event => { run.current?.abort(); setBusy(false); setResult(null); setError(""); setLanguage(event.target.value as typeof language); }}><option value="auto">Deteksi otomatis dengan AI</option>{Object.entries(labelLanguages).map(([key, name]) => <option key={key} value={key}>{name} — pembaca lokal</option>)}</select></label>}
      <label className="field-label" htmlFor="label-file">Pilih foto dari galeri<input id="label-file" className="ui-file-input w-full max-w-full" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { choose(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-label="Foto tabel dengan kamera" onChange={event => { choose(event.target.files?.[0]); event.target.value = ""; }} />
      <button className="ui-btn" type="button" onClick={() => camera.current?.click()}>Ambil foto tabel</button>
      {preview && <img src={preview} alt="Pratinjau tabel nutrisi yang dipilih" className="max-h-96 w-full rounded-box object-contain" onError={() => { run.current?.abort(); setBusy(false); setFile(null); setResult(null); setError("Foto tidak dapat dibuka. Pilih gambar lain."); }} />}
      <p className="text-sm leading-relaxed text-base-content/70">JPG, PNG, atau WebP, maksimal 4 MB. {mode === "account" ? language === "auto" ? "Saat kamu menekan Baca label, foto dikirim ke server dan layanan AI." : "Foto dibaca di server tanpa dikirim ke layanan AI. Pilih bahasa yang cocok dan tampilkan satu kolom gizi dengan jelas." : "Contoh dapat dicoba tanpa foto."}</p>
      <button className="ui-btn w-full" type="button" disabled={busy || (mode === "account" && !file)} onClick={scan}>{busy ? "Membaca label..." : mode === "demo" ? "Coba contoh label" : "Baca label"}</button>
      {busy && <button className="ui-btn ui-btn-ghost" type="button" onClick={() => { run.current?.abort(); setBusy(false); }}>Batalkan</button>}
      {error && <p className="ui-alert ui-alert-error" role="alert">{error}</p>}
    </section>
    {result && <LabelEditor key={JSON.stringify(result)} result={result} />}
  </div>;
}

function LabelEditor({ result }: { result: NutritionLabelResult }) {
  const { setFoodDraft, mode } = useDashboardState();
  const router = useRouter();
  const [values, setValues] = useState<LabelPortionInput>(() => ({
    productName: result.productName ?? "", basisAmount: result.basis.amount === null ? "" : String(result.basis.amount),
    basisUnit: result.basis.unit, consumedAmount: "", actualGrams: "", confirmed: false,
    nutrients: Object.fromEntries(nutritionFields.map(field => [field.key, result.nutrients[field.key] === null ? "" : String(result.nutrients[field.key])])) as LabelPortionInput["nutrients"],
  }));
  const [error, setError] = useState("");
  const unit = values.basisUnit === "serving" ? "porsi" : values.basisUnit === "unknown" ? "satuan acuan" : values.basisUnit;
  function update<K extends keyof LabelPortionInput>(key: K, value: LabelPortionInput[K]) { setValues(current => ({ ...current, [key]: value, confirmed: false })); setError(""); }
  function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const item = labelPortionToFood(values);
      setFoodDraft({ ...createFoodDraft("photo", [item]), origin: "nutrition-label", notes: `Label ditinjau pengguna. Acuan ${values.basisAmount} ${unit}; dikonsumsi ${values.consumedAmount} ${unit}.` });
      router.push("/log/review");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Periksa kembali formulir."); }
  }
  return <section className="surface-panel space-y-5" aria-label="Periksa hasil label">
    <h2 className="text-lg font-semibold">Periksa hasil label</h2>
    <p className="text-sm leading-relaxed">{mode === "demo" ? "Hasil contoh. " : ""}Bahasa label: {result.languages.join(", ") || "belum diketahui"}. Kolom yang dibaca: {result.basis.description || "belum jelas"}.</p>
    {result.warnings.length > 0 && <div className="ui-alert ui-alert-warning"><ul className="space-y-2 list-disc pl-4">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    <details><summary className="cursor-pointer font-semibold">Lihat angka asli yang terbaca</summary><ul className="mt-3 space-y-2 break-words">{result.facts.map((fact, index) => <li key={index}><bdi>{fact.label}</bdi>: <bdi>{fact.qualifier === "less_than" ? "< " : fact.qualifier === "approximate" ? "≈ " : ""}{fact.value ?? "tidak terbaca"} {fact.unit}</bdi></li>)}</ul></details>
    <form className="space-y-5" onSubmit={submit}>
      <label className="field-label" htmlFor="label-name">Nama produk<input id="label-name" className="ui-input w-full" required maxLength={120} value={values.productName} onChange={event => update("productName", event.target.value)} /></label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="field-label" htmlFor="label-basis">Jumlah acuan pada label<input id="label-basis" className="ui-input w-full" type="number" min="0.01" max="10000" step="any" required value={values.basisAmount} onChange={event => update("basisAmount", event.target.value)} /></label>
        <label className="field-label" htmlFor="label-unit">Satuan acuan<select id="label-unit" className="ui-select w-full" required value={values.basisUnit} onChange={event => { setValues(current => ({ ...current, basisUnit: event.target.value as LabelPortionInput["basisUnit"], consumedAmount: "", actualGrams: "", confirmed: false })); setError(""); }}><option value="unknown" disabled>Pilih satuan</option><option value="g">gram (g)</option><option value="ml">mililiter (ml)</option><option value="serving">porsi</option></select></label>
      </div>
      <p className="text-sm leading-relaxed text-base-content/70">Semua angka gizi di bawah harus berasal dari satu kolom yang sama, misalnya per 100 g. Berat bersih kemasan dan % nilai harian berbeda dari acuan ini.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{nutritionFields.map(field => <label key={field.key} className="field-label" htmlFor={`label-${field.key}`}>{field.label} ({field.unit}) per acuan<input id={`label-${field.key}`} className="ui-input w-full" type="number" required min="0" max={field.max} step="any" placeholder="Belum diketahui" value={values.nutrients[field.key]} onChange={event => update("nutrients", { ...values.nutrients, [field.key]: event.target.value })} /></label>)}</div>
      <p className="text-sm leading-relaxed text-base-content/70">Kolom kosong belum berarti nol. Lengkapi dari label atau sumber gizi yang kamu ketahui; isi 0 hanya jika memang nol.</p>
      <label className="field-label" htmlFor="label-consumed">Jumlah yang dimakan ({unit})<input id="label-consumed" className="ui-input w-full" type="number" min="0.01" max="10000" step="any" required value={values.consumedAmount} onChange={event => update("consumedAmount", event.target.value)} /></label>
      {values.basisUnit !== "g" && <><label className="field-label" htmlFor="label-grams">Berat yang dimakan (gram)<input id="label-grams" className="ui-input w-full" type="number" min="0.1" max="10000" step="any" required value={values.actualGrams} onChange={event => update("actualGrams", event.target.value)} /></label><p className="text-sm leading-relaxed text-base-content/70">Isi hasil timbangan atau berat porsi yang diketahui. ml dan jumlah porsi tidak otomatis dapat diubah ke gram.</p></>}
      <label className="flex items-start gap-3 cursor-pointer"><input className="ui-checkbox shrink-0" type="checkbox" required checked={values.confirmed} onChange={event => setValues(current => ({ ...current, confirmed: event.target.checked }))} /><span className="text-sm leading-relaxed">Saya sudah mencocokkan angka, satuan, dan kolom acuan dengan kemasan atau sumber gizi yang saya ketahui.</span></label>
      {error && <p className="ui-alert ui-alert-error" role="alert">{error}</p>}
      <button className="ui-btn ui-btn-primary w-full" type="submit">Hitung porsi dan tinjau</button>
      <p className="text-sm leading-relaxed text-base-content/70">Catatan belum disimpan. Kamu akan meninjau total gizi sebelum menyimpannya.</p>
    </form>
  </section>;
}
