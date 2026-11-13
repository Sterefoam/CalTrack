"use client";
import Link from "next/link";
import { useAdventure } from "./adventure-state";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { Icon } from "@/components/layout/icon";

export function QuestBoard({ compact = false }: { compact?: boolean }) {
  const { adventure, busy, error, notice, act, refresh } = useAdventure();
  const { mode } = useDashboardState();
  return <section className={`surface-panel quest-board ${compact ? "compact" : ""}`} aria-labelledby="quest-heading">
    <div className="section-title-row"><h2 id="quest-heading">Quest harian</h2>{compact ? <Link href="/quests" className="text-button">Hadiah <Icon name="arrow" size={16} /></Link> : <button className="text-button" onClick={refresh}>Perbarui</button>}</div>
    <p className="quest-caption">Langkah kecil tetap berarti. Reset pukul 00.00 WIB.</p>
    {!adventure && !error && <p role="status">Memuat perjalananmu…</p>}
    <ul className="quest-list">{adventure?.quests.map(quest => <li key={quest.id} className={quest.claimed ? "quest-row claimed" : "quest-row"}>
      <span className="quest-check" aria-hidden="true">{quest.claimed ? "✓" : <Icon name="sparkle" size={16} />}</span>
      <div className="quest-copy"><div className="quest-title"><h3>{quest.title}</h3><span>+{quest.xp} XP</span></div>{!compact && <p>{quest.description}</p>}<div className="quest-progress"><progress className="ui-progress" value={quest.progress} max={quest.target} aria-label={quest.title} /><span>{quest.progress}/{quest.target} {quest.unit}</span></div></div>
      {quest.claimed ? <span className="quest-done">Diambil</span> : quest.ready ? <button className="ui-btn ui-btn-sm" disabled={busy} onClick={() => void act("claim", quest.id)}>Ambil XP</button> : <Link href={quest.href} className="quest-go" aria-label={`Kerjakan ${quest.title}`}><Icon name="arrow" size={18} /></Link>}
    </li>)}</ul>
    {error && <p role="alert" className="chat-error">{error} <button className="text-button" onClick={refresh}>Coba lagi</button></p>}
    {notice && <p role="status" className="reward-notice">{notice}</p>}
    {mode === "demo" && <p className="quest-demo">Mode demo · XP berlaku selama sesi ini.</p>}
  </section>;
}
