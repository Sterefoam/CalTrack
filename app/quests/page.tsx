"use client";
import { useAdventure } from "@/components/adventure/adventure-state";
import { QuestBoard } from "@/components/adventure/quest-board";
import { NightLandscape } from "@/components/adventure/night-landscape";
export default function QuestsPage() {
  const { adventure, busy, act } = useAdventure();
  return <div className="content-wrap"><header className="page-heading"><h1>Perjalanan & hadiah</h1><p>Kumpulkan kebiasaan kecil. Buka cerita penjelajahmu.</p></header>
    <div className="journey-summary"><NightLandscape reward={adventure?.equippedReward} /><div><h2>{adventure?.rewards.find(reward => reward.id === adventure.equippedReward)?.name ?? "Penjelajah bulan"}</h2><p>Level {adventure?.level ?? 1} · {adventure?.totalXp ?? 0} XP terkumpul</p><progress className="ui-progress" value={adventure?.levelXp ?? 0} max={100} aria-label="XP menuju level berikutnya" /><p className="field-help">{adventure?.levelXp ?? 0}/100 XP menuju level {(adventure?.level ?? 1) + 1}</p></div></div>
    <QuestBoard /><section className="reward-collection" aria-labelledby="reward-title"><div className="section-title-row"><h2 id="reward-title">Koleksi penjelajah</h2><span>Hadiah kosmetik</span></div><div className="reward-grid">{adventure?.rewards.map(reward => <article className="surface-panel reward-card" key={reward.id}><NightLandscape small reward={reward.id} /><div><h3>{reward.name}</h3><p>{reward.description}</p><p className="reward-requirement">{reward.xp} XP total</p><button className="ui-btn w-full" disabled={busy || !reward.unlocked || adventure.equippedReward === reward.id} onClick={() => void act("equip", reward.id)}>{adventure.equippedReward === reward.id ? "Sedang dipakai" : reward.unlocked ? "Pakai hadiah" : "Belum terbuka"}</button></div></article>)}</div></section><p className="chat-footnote">XP diberikan untuk mencatat, bukan jumlah kalori atau banyaknya makanan yang dimakan. XP yang sudah diambil tetap menjadi milikmu. Hadiah tersimpan di akun.</p></div>;
}
