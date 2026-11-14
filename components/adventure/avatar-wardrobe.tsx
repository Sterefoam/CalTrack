"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { avatarOutfit } from "@/lib/adventure/avatar";
import { useAdventure } from "./adventure-state";
import { ExplorerAvatar } from "./explorer-avatar";

export function AvatarWardrobe() {
  const { adventure, busy, error, act, refresh } = useAdventure();
  const [selection, setSelection] = useState<string | null>(null);
  const [moving, setMoving] = useState(true);
  const portrait = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = portrait.current;
    if (!element) return;
    let visible = false;
    const update = () => { element.dataset.paused = String(!visible || document.hidden); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  const selected = adventure?.rewards.find(reward => reward.id === (selection ?? adventure.equippedReward));
  const outfit = avatarOutfit(selected?.id ?? "moon-scout");
  const wearing = selected?.id === adventure?.equippedReward;
  return <section className="avatar-wardrobe" id="avatar-wardrobe" aria-labelledby="avatar-title">
    <div className="avatar-stage">
      <div className="avatar-stage-heading"><h2 id="avatar-title">Penjelajahmu</h2><span>{adventure ? `Level ${adventure.level}` : "Memuat..."}</span></div>
      <div className="avatar-portrait" ref={portrait}><ExplorerAvatar reward={outfit.id} animated={moving} /></div>
      <div className="avatar-stage-footer"><p>{adventure ? `${adventure.totalXp} XP terkumpul` : "Memuat progres"}</p><button type="button" className="avatar-motion-toggle" aria-pressed={!moving} onClick={() => setMoving(value => !value)}>{moving ? "Jeda gerak" : "Aktifkan gerak"}</button></div>
      <progress className="ui-progress" value={adventure?.levelXp ?? 0} max={100} aria-label="XP menuju level berikutnya" />
      <p className="field-help">{adventure ? `${adventure.levelXp}/100 XP menuju level ${adventure.level + 1}` : "Progres tersimpan di akunmu"}</p>
    </div>
    <div className="avatar-closet">
      <h2>Koleksi penjelajah</h2><p className="field-help">Lihat dulu, lalu pakai set favoritmu.</p>
      <div className="avatar-options" role="group" aria-label="Pratinjau set hadiah">
        {adventure?.rewards.map(reward => <button type="button" className="avatar-option" key={reward.id} aria-pressed={outfit.id === reward.id} aria-label={`Lihat ${reward.name}`} onClick={() => setSelection(reward.id)}>
          <ExplorerAvatar reward={reward.id} decorative /><span><strong>{reward.name}</strong><small>{adventure.equippedReward === reward.id ? "Sedang dipakai" : reward.unlocked ? "Siap dipakai" : `Terbuka pada ${reward.xp} XP`}</small></span><span className="avatar-option-mark" aria-hidden="true">{outfit.id === reward.id && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
        </button>)}
      </div>
      {selected && <div className="avatar-outfit-details" aria-live="polite"><div className="avatar-outfit-title"><h3>{selected.name}</h3><span>{wearing ? "Sedang dipakai" : "Pratinjau"}</span></div><p>{outfit.pieces.join(" · ")}</p><p className="field-help">{selected.unlocked ? "Aksesori dalam set ini dipakai bersama." : `${Math.max(0, selected.xp - (adventure?.totalXp ?? 0))} XP lagi untuk membuka set ini.`}</p><button type="button" className="ui-btn ui-btn-primary" disabled={busy || !selected.unlocked || wearing} onClick={() => void act("equip", selected.id)}>{busy ? "Menyimpan..." : wearing ? "Sedang dipakai" : selected.unlocked ? "Pakai penampilan" : "Belum terbuka"}</button></div>}
      {error && <div className="avatar-error" role="alert"><p>{error}</p><button type="button" className="text-button" onClick={refresh}>Muat ulang progres</button></div>}
      {!adventure && !error && <p className="field-help" role="status">Memuat koleksi hadiah...</p>}
    </div>
  </section>;
}

export function AvatarProfile() {
  const { adventure } = useAdventure();
  const outfit = avatarOutfit(adventure?.equippedReward ?? "moon-scout");
  return <section className="avatar-profile" aria-labelledby="profile-avatar-title"><ExplorerAvatar reward={outfit.id} /><div><h2 id="profile-avatar-title">Avatar perjalananmu</h2><p>{adventure ? `${outfit.name} · Level ${adventure.level}` : "Memuat penampilan..."}</p><p className="field-help">{outfit.pieces.join(" · ")}</p><Link className="text-button" href="/quests#avatar-wardrobe">Ganti penampilan →</Link></div></section>;
}
