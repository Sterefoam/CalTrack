"use client";
import Link from "next/link";
import { useAdventure } from "./adventure-state";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { Icon } from "@/components/layout/icon";
import { useId } from "react";
import type { Adventure } from "@/lib/adventure/quests";

function QuestRow({ quest }: { quest: Adventure["quests"][number] }) {
  const { adventure, busy, act } = useAdventure();
  return <li className={`quest-row ${quest.claimed ? "claimed" : ""} ${quest.optional && !quest.accepted ? "quest-available" : ""}`}>
    <span className="quest-check" aria-hidden="true">{quest.claimed ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg> : <Icon name="sparkle" size={16} />}</span>
    <div className="quest-copy"><div className="quest-title"><h3>{quest.title}</h3><span>+{quest.xp} XP</span></div><p>{quest.description}</p>{quest.accepted && <div className="quest-progress"><progress className="ui-progress" value={quest.progress} max={quest.target} aria-label={quest.title} /><span>{quest.progress}/{quest.target} {quest.unit}</span></div>}</div>
    {quest.claimed ? <span className="quest-done">Diambil</span> : !quest.accepted ? <button className="ui-btn ui-btn-sm" disabled={busy || !adventure?.optionalSlotsRemaining} onClick={() => void act("accept", quest.id)}>{adventure?.optionalSlotsRemaining ? "Pilih quest" : "Slot terisi"}</button> : quest.ready ? <button className="ui-btn ui-btn-sm" disabled={busy} onClick={() => void act("claim", quest.id)}>Ambil XP</button> : <Link href={quest.href} className="quest-go" aria-label={`Kerjakan ${quest.title}`}><Icon name="arrow" size={18} /></Link>}
  </li>;
}

export function QuestBoard({ compact = false }: { compact?: boolean }) {
  const { adventure, error, notice, refresh } = useAdventure();
  const { mode } = useDashboardState();
  const headingId = useId();
  return <section className={`surface-panel quest-board ${compact ? "compact" : ""}`} aria-labelledby={headingId}>
    <div className="section-title-row"><h2 id={headingId}>Quest harian</h2>{compact ? <Link href="/quests" className="text-button">Hadiah <Icon name="arrow" size={16} /></Link> : <button className="text-button" onClick={refresh}>Perbarui</button>}</div>
    <p className="quest-caption">Langkah kecil tetap berarti. Reset pukul 00.00 WIB.</p>
    {!adventure && !error && <p role="status">Memuat perjalananmu…</p>}
    <ul className="quest-list">{adventure?.quests.map(quest => <QuestRow quest={quest} key={quest.id} />)}{compact && adventure?.optionalQuests.filter(quest => quest.accepted).map(quest => <QuestRow quest={quest} key={quest.id} />)}</ul>
    {compact ? <Link href="/quests#quest-pilihan" className="text-button optional-quest-link">Pilih petualangan tambahan <Icon name="arrow" size={14} /></Link> : adventure && <div className="optional-quests" id="quest-pilihan"><div className="section-title-row"><h2>Quest pilihan</h2><span>{2 - adventure.optionalSlotsRemaining}/2 dipilih</span></div><p className="quest-caption">Empat pilihan berganti setiap hari. Pilih maksimal dua untuk hari ini; catatan hari ini juga dihitung. Tidak ada penalti jika belum selesai. Fitur AI membutuhkan mesin analisis yang siap.</p><ul className="quest-list">{adventure.optionalQuests.map(quest => <QuestRow quest={quest} key={quest.id} />)}</ul></div>}
    {error && <p role="alert" className="chat-error">{error} <button className="text-button" onClick={refresh}>Coba lagi</button></p>}
    {notice && <p role="status" className="reward-notice">{notice}</p>}
    {mode === "demo" && <p className="quest-demo">Mode demo · XP berlaku selama sesi ini.</p>}
  </section>;
}
