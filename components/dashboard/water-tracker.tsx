"use client";

import { useState } from "react";

type WaterTrackerProps = { amountMl: number; targetMl: number; onAdd: (amount: number) => void; onRemove: (amount: number) => void; onReset: () => void };
const formatMl = (amount: number) => new Intl.NumberFormat("id-ID").format(amount);

export function WaterTracker({ amountMl, targetMl, onAdd, onRemove, onReset }: WaterTrackerProps) {
  const [serving, setServing] = useState(250);
  const progress = targetMl > 0 ? Math.min(100, Math.round(amountMl / targetMl * 100)) : 0;
  return <article className="panel-card water-card">
    <div className="section-title-row"><div><div className="card-kicker">Jangan lupa minum</div><h2>Air minum</h2></div><button className="water-add" aria-label={`Tambah air ${serving} mililiter`} disabled={amountMl >= 20000} onClick={() => onAdd(serving)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button></div>
    <div className="water-total" aria-live="polite"><strong>{formatMl(amountMl)}</strong><span> ml dari {formatMl(targetMl)} ml</span></div>
    <div className="water-progress-track" role="progressbar" aria-label="Progres target air minum" aria-valuemin={0} aria-valuemax={targetMl} aria-valuenow={Math.min(amountMl, targetMl)} aria-valuetext={`${formatMl(amountMl)} dari ${formatMl(targetMl)} mililiter`}><span style={{ width: `${progress}%` }} /></div>
    <p className="water-status">{amountMl >= targetMl ? "Target hari ini tercapai" : `${formatMl(Math.max(0, targetMl - amountMl))} ml lagi menuju target`} <strong>{progress}%</strong></p>
    <label className="water-serving" htmlFor="water-serving">Takaran<select id="water-serving" className="ui-select w-full" value={serving} onChange={(e) => setServing(Number(e.target.value))}><option value={100}>100 ml</option><option value={250}>250 ml · satu gelas</option><option value={500}>500 ml · satu botol</option></select></label>
    <div className="water-controls"><button className="ui-btn" onClick={() => onRemove(serving)} disabled={amountMl === 0}>Kurangi {serving} ml</button><button className="ui-btn" onClick={() => onAdd(serving)} disabled={amountMl >= 20000}>Tambah {serving} ml</button></div>
    <div className="water-footer"><span>Jumlah dicatat untuk hari ini.</span><button onClick={onReset} disabled={amountMl === 0}>Atur ulang</button></div>
  </article>;
}
