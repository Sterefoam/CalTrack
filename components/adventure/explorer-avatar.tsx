import { avatarOutfit } from "@/lib/adventure/avatar";

// One drawing across the wardrobe, profile and campsite keeps saved outfits consistent.
export function ExplorerDrawing({ reward = "moon-scout" }: { reward?: string }) {
  const { id } = avatarOutfit(reward);
  const cloak = id !== "moon-scout";
  const aurora = id === "aurora-guide";
  return <g className="explorer-drawing" data-outfit={id} strokeLinejoin="round" strokeLinecap="round">
    <ellipse cx="120" cy="265" rx="54" ry="8" fill="var(--avatar-shadow)" />
    <g className="avatar-legs">
      <path d="m98 208-3 38h19l9-39m1 1 9 36 18-4-8-37" fill="var(--avatar-trousers)" />
      <path d="m94 238-5 16c-2 7 4 9 12 9h18v-23m14-4 2 18c0 6 8 7 14 6l16-3c5-1 5-8 0-10l-14-11" fill="var(--avatar-boots)" stroke="var(--avatar-outline)" strokeWidth="3" />
      <path d="M95 248h16m29-4 10-2" stroke="var(--avatar-stitch)" strokeWidth="3" />
    </g>
    <g className="avatar-breath">
      <g data-accessory="satchel"><path d="M76 131c-14-2-24 4-24 18v40c0 8 9 12 24 9l16-5-4-54z" fill="var(--avatar-bag)" stroke="var(--avatar-outline)" strokeWidth="3" /><path d="m56 145 23 5-2 13-23-4" fill="var(--avatar-bag-flap)" /><path d="M64 155v10" stroke="var(--avatar-stitch)" strokeWidth="4" /></g>
      {cloak && <path className="avatar-cape" data-accessory="cloak" d="M86 129c-10 18-14 47-29 85 24 2 37 17 61 10 20 8 37-3 58-4-17-33-19-70-31-87z" fill="var(--avatar-cloak-dark)" stroke="var(--avatar-outline)" strokeWidth="3" />}
      <path d="M89 132c-15 8-19 24-20 43l11 20 13-7-7-17 12-17m47-19c11 10 16 21 22 38l-12 10-17-29" fill="var(--avatar-shirt)" stroke="var(--avatar-outline)" strokeWidth="3" />
      <path d="M81 182c-7-2-13 4-11 11 2 8 7 11 13 8l9-7-4-6" fill="var(--avatar-skin)" stroke="var(--avatar-outline)" strokeWidth="2.5" />
      <path d="M95 126c10-5 33-6 45 1l13 74c-10 16-50 18-65 4z" fill="var(--avatar-shirt)" stroke="var(--avatar-outline)" strokeWidth="3" />
      <path d="m102 132 23 69" stroke="var(--avatar-bag)" strokeWidth="7" /><path d="m98 202 45-3" stroke="var(--avatar-bag-flap)" strokeWidth="8" /><rect x="118" y="197" width="11" height="9" rx="2" fill="var(--avatar-metal)" />
      {cloak ? <g data-accessory="mantle"><path d="M94 121c-17 12-21 33-19 51l33-8 15-30 15 30 25 5c-1-24-9-41-22-48z" fill="var(--avatar-cloak)" stroke="var(--avatar-outline)" strokeWidth="3" /><path d="m87 152 15-23m43 22-9-21" stroke="var(--avatar-cloak-dark)" strokeWidth="3" /><g data-accessory="moon-brooch"><circle cx="123" cy="137" r="8" fill="var(--avatar-metal)" /><path d="M125 131a6 6 0 1 0 3 9 6 6 0 0 1-3-9" fill="var(--avatar-outline)" /></g></g> : <g data-accessory="scarf"><path d="m101 121 33-1 9 16-16 12-31-14z" fill="var(--avatar-cloak)" stroke="var(--avatar-outline)" strokeWidth="3" /><path d="m132 138 17 31-14 1-11-25" fill="var(--avatar-cloak-dark)" /></g>}
      <g className="avatar-head">
        <path d="M82 79c-6-28 9-48 35-49 29-2 45 17 43 45l-9 26-65-1z" fill="var(--avatar-hair)" /><ellipse cx="85" cy="92" rx="8" ry="11" fill="var(--avatar-skin)" /><ellipse cx="154" cy="91" rx="8" ry="11" fill="var(--avatar-skin)" />
        <path d="M87 73c2-24 58-27 65 1l-1 27c-3 20-20 28-33 26-20-2-31-15-31-33z" fill="var(--avatar-skin)" stroke="var(--avatar-outline)" strokeWidth="2.5" /><path d="M85 79c-9-19 1-40 24-43 27-6 46 9 49 34l-14-4-12-14c-7 14-23 19-42 15l-3 16" fill="var(--avatar-hair)" />
        <path d="m102 82 9-2m22 0 9 2" stroke="var(--avatar-outline)" strokeWidth="2.5" /><g className="avatar-eyes"><ellipse cx="107" cy="92" rx="3" ry="4.5" fill="var(--avatar-outline)" /><ellipse cx="137" cy="92" rx="3" ry="4.5" fill="var(--avatar-outline)" /></g>
        <path d="m122 94-2 7h4" stroke="var(--avatar-skin-shade)" strokeWidth="2.5" /><path d="M115 109q7 6 14-1" stroke="var(--avatar-outline)" strokeWidth="2.5" fill="none" /><path d="m96 103 7 1m37-1 6-1" stroke="var(--avatar-cheek)" strokeWidth="4" />
        {aurora && <g data-accessory="hat"><path d="M83 61c-1-22 12-39 36-39 20 0 32 12 35 32l16 9c-17 11-64 11-94 5z" fill="var(--avatar-cloak)" stroke="var(--avatar-outline)" strokeWidth="3" /><path d="M89 53q29 10 60-1" stroke="var(--avatar-cloak-dark)" strokeWidth="7" /><path d="m142 43 8-16m-8 16c-5-14-2-22 8-26 4 12 1 21-8 26" fill="var(--avatar-metal)" stroke="var(--avatar-outline)" strokeWidth="2" /></g>}
      </g>
      <g className="avatar-hand"><path d="m158 169 10-9c4-3 9 0 8 5l-4 12c-3 7-12 8-17 2" fill="var(--avatar-skin)" stroke="var(--avatar-outline)" strokeWidth="2.5" />
        {aurora ? <g data-accessory="lantern"><path d="M172 179v9m-7 8v-6a7 7 0 0 1 14 0v6" stroke="var(--avatar-metal)" strokeWidth="3" fill="none" /><path d="m160 196 24-1-3 25-18 1z" fill="var(--avatar-metal)" stroke="var(--avatar-outline)" strokeWidth="3" /><path d="m169 201-1 13m8-13-1 13" stroke="var(--avatar-lamp)" strokeWidth="4" /></g> : <g data-accessory="field-journal"><path d="m167 157 18 4-7 25-19-6z" fill="var(--avatar-bag)" stroke="var(--avatar-outline)" strokeWidth="2.5" /><path d="m171 163 8 2m-10 4 8 2" stroke="var(--avatar-stitch)" strokeWidth="2" /></g>}
      </g>
    </g>
  </g>;
}

export function ExplorerAvatar({ reward = "moon-scout", animated = false, decorative = false }: { reward?: string; animated?: boolean; decorative?: boolean }) {
  const outfit = avatarOutfit(reward);
  return <svg className={`explorer-avatar${animated ? " is-alive" : ""}`} viewBox="0 0 240 280" fill="none" role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : `Avatar ${outfit.name}: ${outfit.pieces.join(", ")}`}><ExplorerDrawing reward={outfit.id} /></svg>;
}
