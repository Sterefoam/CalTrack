"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { PhysicalFields, GoalFields } from "./profile-fields";
import { activityLevels, goals, previewTargets, type DemoProfile } from "@/lib/demo/profile";
import { formatNumber } from "@/lib/demo/nutrition-data";

const steps = ["Data tubuh", "Kebiasaan", "Targetmu"];

export function OnboardingFlow() {
  const { profile, saveProfile, mode } = useDashboardState();
  const [draft, setDraft] = useState(profile);
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const update = <K extends keyof DemoProfile>(key: K, value: DemoProfile[K]) => { setDraft((current) => ({ ...current, [key]: value })); setError(""); };
  const targets = previewTargets(draft);
  useEffect(() => { heading.current?.focus(); }, [step, complete]);
  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) { setError("Isi nama yang ingin ditampilkan."); return; }
    if (step < 2) { setStep(step + 1); return; }
    if (busy) return;
    setBusy(true); setError("");
    try { await saveProfile({ ...draft, name: draft.name.trim() }); setComplete(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Profil belum tersimpan."); }
    finally { setBusy(false); }
  }

  return <div className="content-wrap onboarding-page">
    <header className="page-heading"><h1>Kenali kebutuhanmu</h1><p>Mulai dari data diri untuk mendapatkan target harian yang sesuai.</p></header>
    <p className="demo-note">{mode === "demo" ? "Mode demo. Profil dan target berlaku selama sesi ini di browser." : "Lengkapi data tubuhmu untuk menyimpan target harian ke akun."}</p>
    <ol className="ui-steps w-full mb-6" aria-label="Tahapan pengaturan profil">{steps.map((label, index) => <li key={label} className={`ui-step ${index <= step ? "ui-step-neutral" : ""}`} aria-current={index === step ? "step" : undefined}>{label}</li>)}</ol>
    <section className="surface-panel">
      {complete ? <div className="form-stack"><h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">{mode === "account" ? "Target harian siap" : "Target demo siap"}</h2><p role="status">Profil {draft.name.trim()} sudah diterapkan ke Dashboard.</p><p className="target-number">{formatNumber(targets.calories)} <span>kkal per hari</span></p><Link href="/" className="ui-btn ui-btn-primary">Mulai catat makanan</Link><Link href="/profile" className="ui-btn ui-btn-ghost">Lihat profil</Link></div> : <form onSubmit={next} className="form-stack" key={step}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">{step === 0 ? "Ceritakan tentang dirimu" : step === 1 ? "Aktivitas dan tujuanmu" : "Tinjau target harianmu"}</h2>
        {step === 0 && <><p className="field-help onboarding-help">Perhitungan ini untuk usia dewasa, 18 tahun ke atas.</p><PhysicalFields draft={draft} update={update} /></>}
        {step === 1 && <GoalFields draft={draft} update={update} />}
        {step === 2 && <><dl className="nutrition-facts"><div><dt>Nama</dt><dd>{draft.name}</dd></div><div><dt>Data tubuh</dt><dd>{draft.age} tahun · {draft.weightKg} kg · {draft.heightCm} cm</dd></div><div><dt>Aktivitas</dt><dd>{activityLevels[draft.activityLevel].label}</dd></div><div><dt>Tujuan</dt><dd>{goals[draft.goal]}</dd></div></dl><p className="target-number">{formatNumber(targets.calories)} <span>kkal per hari</span></p><dl className="nutrition-facts"><div><dt>Protein</dt><dd>{targets.proteinG} g</dd></div><div><dt>Karbohidrat</dt><dd>{targets.carbsG} g</dd></div><div><dt>Lemak</dt><dd>{targets.fatG} g</dd></div></dl><p className="field-help onboarding-help">Estimasi awal dari data tubuh dan tingkat aktivitas. Kamu dapat menyesuaikan profil kapan saja.</p></>}
        {error && <p className="ui-alert ui-alert-error" role="alert">{error}</p>}
        <div className="onboarding-actions">{step > 0 && <button type="button" className="ui-btn" disabled={busy} onClick={() => setStep(step - 1)}>Kembali</button>}<button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>{busy ? "Menyimpan..." : step < 2 ? "Lanjut" : mode === "account" ? "Simpan target" : "Terapkan target demo"}</button></div>
      </form>}
    </section>
  </div>;
}
