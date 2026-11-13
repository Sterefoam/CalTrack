"use client";
import Link from "next/link";
import { useAdventure } from "./adventure-state";
import { NightLandscape } from "./night-landscape";
import { Icon } from "@/components/layout/icon";
export function JourneyHome() {
  const { adventure } = useAdventure();
  return <section className="journey-home" aria-label="Perjalanan dan pendamping AI">
    <article className="journey-scene"><NightLandscape reward={adventure?.equippedReward} /><div className="journey-copy"><h2>Langkah kecil.<br />Petualangan baru.</h2><p>{adventure?.rewards.find(reward => reward.id === adventure.equippedReward)?.name ?? "Penjelajah bulan"} · Level {adventure?.level ?? 1}</p><div className="journey-xp"><span>{adventure?.totalXp ?? 0} XP terkumpul</span><Link href="/quests">Lihat perjalanan <Icon name="arrow" size={14} /></Link></div><progress className="ui-progress" value={adventure?.levelXp ?? 0} max={100} aria-label="XP menuju level berikutnya" /></div></article>
    <article className="luna-invite surface-panel"><div className="section-title-row"><h2>Temui Luna</h2><Icon name="sparkle" size={22} /></div><p>Bingung mau makan apa?<br />Kita cari ide bersama.</p><Link href="/chat" className="ui-btn">Bertanya ke AI <Icon name="arrow" size={16} /></Link><span className="luna-invite-note">Saran makanan dari catatan harianmu</span></article>
  </section>;
}
