"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { previewTargets, type DemoProfile } from "@/lib/demo/profile";
import { PhysicalFields, GoalFields } from "./profile-fields";
import { formatNumber } from "@/lib/demo/nutrition-data";

export function ProfileForm({ onboarding = false }: { onboarding?: boolean }) {
  const { profile, saveProfile } = useDashboardState();
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof DemoProfile>(key: K, value: DemoProfile[K]) => { setDraft((current) => ({ ...current, [key]: value })); setSaved(false); setError(""); };
  const valid = draft.age >= 18 && draft.age <= 100 && draft.weightKg >= 30 && draft.weightKg <= 300 && draft.heightCm >= 120 && draft.heightCm <= 230;
  const preview = valid ? previewTargets(draft) : null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || !valid) { setError("Periksa kembali nama dan data fisikmu."); return; }
    saveProfile({ ...draft, name: draft.name.trim() });
    setSaved(true);
  }
  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>{onboarding ? "Kenali kebutuhanmu" : "Profil & target"}</h1><p>Sesuaikan target harian dengan tubuh dan aktivitasmu.</p></header>
    <p className="demo-note">Mode demo. Perubahan berlaku selama sesi ini di browser.</p>
    <div className="profile-grid">
      <form onSubmit={submit} className="form-stack surface-panel">
        <h2 className="text-xl font-semibold">Data dirimu</h2>
        <PhysicalFields draft={draft} update={update} />
        <GoalFields draft={draft} update={update} />
        {error && <p className="ui-alert ui-alert-error" role="alert">{error}</p>}
        {saved && <p className="ui-alert ui-alert-success" role="status">Profil demo diperbarui. Target di dashboard sudah disesuaikan.</p>}
        <button type="submit" className="ui-btn ui-btn-primary">{onboarding ? "Terapkan target demo" : "Simpan profil demo"}</button>
        <Link href="/" className="ui-btn ui-btn-ghost">{saved ? "Lihat dashboard" : "Kembali ke dashboard"}</Link>
      </form>
      <aside className="surface-panel target-preview"><h2>Pratinjau target harian</h2>{preview ? <><p className="target-number">{formatNumber(preview.calories)} <span>kkal</span></p><dl className="nutrition-facts"><div><dt>Protein</dt><dd>{preview.proteinG} g</dd></div><div><dt>Karbohidrat</dt><dd>{preview.carbsG} g</dd></div><div><dt>Lemak</dt><dd>{preview.fatG} g</dd></div></dl></> : <p>Lengkapi data fisik untuk melihat estimasi.</p>}<p className="field-help mt-6">Estimasi untuk dewasa menggunakan Mifflin-St Jeor dan tingkat aktivitas. Kebutuhan setiap orang bisa berbeda.</p></aside>
    </div>
  </div>;
}
