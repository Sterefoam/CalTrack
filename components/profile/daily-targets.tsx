"use client";

import Link from "next/link";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { formatNumber } from "@/lib/demo/nutrition-data";
import { activityLevels, calculateTargets, goals } from "@/lib/nutrition/profile";

export function DailyTargets() {
  const { profile, targets, mode, hasProfile } = useDashboardState();
  if (mode === "account" && !hasProfile) return <div className="content-wrap"><h1>Target belum diatur</h1><p>Lengkapi profil untuk menghitung kebutuhan harianmu.</p><Link className="ui-btn mt-4" href="/onboarding">Atur profil</Link></div>;
  const energy = calculateTargets(profile);
  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>Target harian</h1><p>Kebutuhan energi dan gizi berdasarkan profil {profile.name}.</p></header>
    <p className="demo-note">{mode === "account" ? "Target mengikuti profil yang tersimpan di akunmu." : "Mode demo. Target mengikuti profil selama sesi ini di browser."}</p>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="surface-panel form-stack">
        <h2 className="text-xl font-semibold">{goals[profile.goal]}</h2>
        <p className="target-number">{formatNumber(targets.calories)} <span>kkal per hari</span></p>
        <dl className="nutrition-facts">
          <div><dt>Energi saat istirahat (BMR)</dt><dd>{formatNumber(Math.round(energy.bmr))} kkal</dd></div>
          <div><dt>Energi dengan aktivitas (TDEE)</dt><dd>{formatNumber(Math.round(energy.tdee))} kkal</dd></div>
        </dl>
        <p className="field-help">Aktivitas: {activityLevels[profile.activityLevel].label}. Estimasi Mifflin-St Jeor untuk usia dewasa; kebutuhan setiap orang bisa berbeda.</p>
        <Link href="/profile" className="ui-btn ui-btn-primary">Sesuaikan profil & tujuan</Link>
      </section>
      <section className="surface-panel form-stack">
        <h2 className="text-xl font-semibold">Komposisi harianmu</h2>
        <dl className="nutrition-facts">
          <div><dt>Protein</dt><dd>{formatNumber(targets.proteinG)} g</dd></div>
          <div><dt>Karbohidrat</dt><dd>{formatNumber(targets.carbsG)} g</dd></div>
          <div><dt>Lemak</dt><dd>{formatNumber(targets.fatG)} g</dd></div>
          <div><dt>Air</dt><dd>{formatNumber(targets.waterMl)} ml</dd></div>
        </dl>
        <p className="field-help">Target adalah panduan awal. Bila memiliki kebutuhan gizi khusus, diskusikan penyesuaian dengan tenaga kesehatan.</p>
        <Link href="/" className="ui-btn">Lihat progres di dashboard</Link>
      </section>
    </div>
  </div>;
}
