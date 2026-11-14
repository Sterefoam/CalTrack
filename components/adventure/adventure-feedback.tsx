"use client";
import Link from "next/link";
import { useEffect, type CSSProperties } from "react";
import type { Achievement } from "@/lib/adventure/achievements";
import { Icon } from "@/components/layout/icon";

export function AdventureFeedback({ event, onClose }: { event: Achievement & { id: number }; onClose: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onClose, event.kind === "xp" || event.kind === "equip" ? 4500 : 10000); return () => clearTimeout(timer); }, [event, onClose]);
  const title = event.kind === "level" ? `Naik ke level ${event.level}!` : event.kind === "equip" ? "Penampilan baru dipakai" : event.kind === "reward" ? "Hadiah baru terbuka!" : `+${event.xp} XP untuk perjalananmu`;
  return <aside className={`achievement-toast achievement-${event.kind}`} aria-label="Pencapaian perjalanan">
    <div className="achievement-emblem" aria-hidden="true"><Icon name={event.kind === "equip" ? "moon" : "sparkle"} size={32} />{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--spark-angle": `${index * 45}deg` } as CSSProperties} />)}</div>
    <div className="achievement-message" role="status" aria-live="polite" aria-atomic="true"><h2>{title}</h2><p>{event.kind === "level" ? `+${event.xp} XP. Langkah kecilmu membawamu lebih jauh.` : event.kind === "equip" ? event.rewardName : "Catatanmu menjadi bagian dari petualangan."}</p>{event.rewards.length > 0 && <p className="achievement-unlocks">Terbuka: {event.rewards.join(", ")}</p>}{event.rewards.length > 0 && <Link href="/quests" className="text-button" onClick={onClose}>Lihat hadiah <Icon name="arrow" size={14} /></Link>}</div>
    <button className="ui-btn ui-btn-ghost ui-btn-sm achievement-close" aria-label="Tutup pemberitahuan pencapaian" onClick={onClose}>×</button>
  </aside>;
}
