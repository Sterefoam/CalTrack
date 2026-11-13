export const questDefinitions = [
  { id: "first-log", title: "Jejak pertama", description: "Catat satu waktu makan hari ini.", target: 1, xp: 20, metric: "meals", href: "/log", unit: "catatan" },
  { id: "meal-rhythm", title: "Ritme harian", description: "Catat dua waktu makan yang berbeda.", target: 2, xp: 35, metric: "types", href: "/log", unit: "waktu makan" },
  { id: "food-journal", title: "Jurnal penjelajah", description: "Kenali tiga makanan berbeda lewat catatanmu.", target: 3, xp: 45, metric: "foods", href: "/log/search", unit: "makanan" }
] as const;
export const rewardDefinitions = [
  { id: "moon-scout", name: "Penjelajah bulan", xp: 0, description: "Awal perjalanan kecilmu.", color: "moon" },
  { id: "orbit-cloak", name: "Jubah orbit", xp: 100, description: "Jubah untuk langkah yang konsisten.", color: "orbit" },
  { id: "aurora-guide", name: "Pemandu aurora", xp: 300, description: "Cahaya baru untuk perjalananmu.", color: "aurora" }
] as const;
export type QuestMetrics = { meals: number; types: number; foods: number };
export function adventureView(day: string, metrics: QuestMetrics, claimed: string[], totalXp: number, equippedReward: string) {
  return { day, totalXp, level: Math.floor(totalXp / 100) + 1, levelXp: totalXp % 100, equippedReward,
    quests: questDefinitions.map(quest => ({ ...quest, progress: Math.min(quest.target, metrics[quest.metric]), ready: metrics[quest.metric] >= quest.target, claimed: claimed.includes(quest.id) })),
    rewards: rewardDefinitions.map(reward => ({ ...reward, unlocked: totalXp >= reward.xp })) };
}
export type Adventure = ReturnType<typeof adventureView>;
