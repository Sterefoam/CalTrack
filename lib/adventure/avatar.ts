import { rewardDefinitions } from "./quests";

export const avatarOutfits = {
  "moon-scout": { pieces: ["Syal langit", "Tas bekal", "Sepatu perjalanan"] },
  "orbit-cloak": { pieces: ["Jubah orbit", "Bros bulan", "Tas bekal"] },
  "aurora-guide": { pieces: ["Mantel aurora", "Topi penjelajah", "Lentera kecil"] }
} as const;

export function avatarOutfit(reward: string) {
  const id = reward === "orbit-cloak" || reward === "aurora-guide" ? reward : "moon-scout";
  return { id, name: rewardDefinitions.find(reward => reward.id === id)!.name, ...avatarOutfits[id] };
}
