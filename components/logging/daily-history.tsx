"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { formatNumber, mealLabels, sumNutrition, type DemoFoodLog, type MealType } from "@/lib/demo/nutrition-data";
import { localDateString } from "@/lib/demo/local-date";
import { Dialog } from "@/components/layout/dialog";
import { NutritionSummary } from "./nutrition-summary";

export function DailyHistory() {
  const { foodLogs } = useDashboardState();
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [mealType, setMealType] = useState<MealType | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DemoFoodLog | null>(null);
  useEffect(() => { const current = localDateString(); setToday(current); setDate(current); }, []);
  const filtered = foodLogs.filter((log) => (log.date ?? today) === date && (mealType === "all" || log.mealType === mealType) && (!query.trim() || log.items.some((item) => item.foodName.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID"))))).sort((a, b) => a.time.localeCompare(b.time));
  const totals = sumNutrition(filtered.flatMap((log) => log.items));

  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>Riwayat makan</h1><p>Lihat kembali hidangan dan asupan yang sudah dicatat.</p></header>
    <p className="demo-note">Mode demo. Riwayat menampilkan data contoh dan catatan dari sesi ini.</p>
    <div className="history-filters"><label className="field-label" htmlFor="history-date">Tanggal<input className="ui-input w-full" id="history-date" type="date" value={date} max={today || undefined} onChange={(e) => setDate(e.target.value)} /></label><label className="field-label" htmlFor="history-meal">Waktu makan<select className="ui-select w-full" id="history-meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType | "all")}><option value="all">Semua waktu makan</option>{Object.entries(mealLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label className="field-label" htmlFor="history-query">Nama makanan<input className="ui-input w-full" id="history-query" type="search" maxLength={120} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari di riwayat" /></label></div>
    <div className="history-total" aria-live="polite"><span>{filtered.length} catatan{mealType !== "all" || query.trim() ? " sesuai filter" : " pada tanggal ini"}</span><strong>{formatNumber(totals.calories)} <span>kkal total</span></strong></div>
    {!today ? <p role="status">Memuat tanggal...</p> : filtered.length === 0 ? <section className="surface-panel"><h2 className="text-xl mb-3">{query || mealType !== "all" ? "Tidak ada catatan yang cocok" : "Belum ada catatan pada tanggal ini"}</h2><p className="photo-description">{query || mealType !== "all" ? "Coba hapus pencarian atau ubah filter waktu makan." : "Setiap hidangan yang disimpan akan muncul di riwayat."}</p><Link className="ui-btn" href="/log">Catat makanan hari ini</Link></section> : <div className="history-groups">{Object.entries(mealLabels).map(([key, label]) => {
      const logs = filtered.filter((log) => log.mealType === key);
      return logs.length > 0 && <section className="surface-panel" key={key}><h2>{label}</h2><ul className="history-log-list">{logs.map((log) => <li key={log.id}><button className="history-log" onClick={() => setSelected(log)}><div><time>{log.time}</time><strong>{log.items.map((item) => item.foodName).join(", ")}</strong><span>{log.items.length} komponen · {formatNumber(log.items.reduce((sum, item) => sum + item.weightGrams, 0))} g</span></div><span className="history-calories">{formatNumber(sumNutrition(log.items).calories)}<small>kkal</small></span></button></li>)}</ul></section>;
    })}</div>}
    {selected && <Dialog title={`${mealLabels[selected.mealType]} · ${selected.time}`} onClose={() => setSelected(null)}><ul className="history-detail-items">{selected.items.map((item, index) => <li key={`${item.foodName}-${index}`}><strong>{item.foodName}</strong><span>{formatNumber(item.weightGrams)} g · {formatNumber(item.calories)} kkal</span></li>)}</ul><NutritionSummary items={selected.items} /></Dialog>}
  </div>;
}
