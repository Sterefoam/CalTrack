import type { Adventure } from "./quests";

export type Achievement = { kind: "level" | "reward" | "xp" | "equip"; level: number; xp: number; rewards: string[]; rewardName?: string };
// Only successful mutations call this: loading saved progress never replays a celebration.
export function achievementFor(before: Adventure, after: Adventure): Achievement | null {
  const xp = after.totalXp - before.totalXp;
  const rewards = after.rewards.filter(reward => reward.unlocked && !before.rewards.some(previous => previous.id === reward.id && previous.unlocked)).map(reward => reward.name);
  if (xp > 0) return { kind: after.level > before.level ? "level" : rewards.length ? "reward" : "xp", level: after.level, xp, rewards };
  if (before.equippedReward !== after.equippedReward) return { kind: "equip", level: after.level, xp: 0, rewards: [], rewardName: after.rewards.find(reward => reward.id === after.equippedReward)?.name };
  return null;
}
