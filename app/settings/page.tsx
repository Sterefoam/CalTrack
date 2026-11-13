"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import type { ReminderSettings } from "@/lib/demo/reminders";

export default function SettingsPage() {
  const { profile, mode, reminders, setReminders } = useDashboardState();
  const [draft, setDraft] = useState(reminders);
  const [saved, setSaved] = useState(false);
  function update<K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) {
    setDraft(current => ({ ...current, [key]: value })); setSaved(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setReminders({ ...draft }); setSaved(true);
  }
  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>Pengaturan</h1><p>Atur profil dan waktu yang nyaman untuk kebiasaan makanmu.</p></header>
    <section className="surface-panel form-stack mb-6" aria-labelledby="settings-profile"><h2 id="settings-profile" className="text-xl font-semibold">Profilmu</h2><p>{profile.name} · {mode === "account" ? "Akun terhubung" : "Mode demo"}</p><div className="flex flex-wrap gap-3"><Link className="ui-btn" href="/profile">Edit profil & tujuan</Link><Link className="ui-btn ui-btn-ghost" href="/targets">Lihat target harian</Link></div></section>
    <section className="surface-panel" aria-labelledby="settings-reminders"><h2 id="settings-reminders" className="text-xl font-semibold">Pengingat harian</h2><p className="demo-note mt-4">Coba jadwal pengingat selama sesi ini. Pengaturan ini belum mengirim notifikasi dan kembali ke awal saat halaman dimuat ulang.</p>
      <form className="form-stack" onSubmit={submit}>
        <label className="flex items-center justify-between gap-4" htmlFor="reminder-meals"><span>Pengingat waktu makan</span><input id="reminder-meals" className="ui-toggle" type="checkbox" checked={draft.mealsEnabled} onChange={e => update("mealsEnabled", e.target.checked)} /></label>
        <fieldset disabled={!draft.mealsEnabled} className="form-stack disabled:opacity-60"><legend className="field-help mb-3">Waktu mengikuti jam perangkatmu.</legend><div className="grid gap-4 sm:grid-cols-3">{([ ["breakfast", "Sarapan"], ["lunch", "Makan siang"], ["dinner", "Makan malam"] ] as const).map(([key, label]) => <label className="field-label" key={key} htmlFor={`reminder-${key}`}>{label}<input id={`reminder-${key}`} type="time" required className="ui-input w-full min-w-0" value={draft[key]} onChange={e => update(key, e.target.value)} /></label>)}</div></fieldset>
        <label className="flex items-center justify-between gap-4" htmlFor="reminder-water"><span>Pengingat minum air</span><input id="reminder-water" className="ui-toggle" type="checkbox" checked={draft.waterEnabled} onChange={e => update("waterEnabled", e.target.checked)} /></label>
        <label className="field-label" htmlFor="reminder-water-interval">Jeda pengingat air<select id="reminder-water-interval" className="ui-select w-full" disabled={!draft.waterEnabled} value={draft.waterIntervalMinutes} onChange={e => update("waterIntervalMinutes", Number(e.target.value))}><option value={60}>Setiap 1 jam</option><option value={90}>Setiap 1,5 jam</option><option value={120}>Setiap 2 jam</option><option value={180}>Setiap 3 jam</option></select></label>
        {saved && <p className="ui-alert ui-alert-success" role="status">Jadwal contoh diterapkan selama sesi ini. Notifikasi belum dikirim.</p>}
        <button className="ui-btn ui-btn-primary" type="submit">Simpan jadwal contoh</button>
      </form>
    </section>
  </div>;
}
