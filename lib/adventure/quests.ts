export const dailyLoginDefinition = { id: "daily-login", title: "Hadiah login harian", xp: 10 } as const;
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
export const optionalQuestDefinitions = [
  { id: "morning-pages", title: "Halaman pagi", description: "Catat sarapanmu hari ini, dengan porsi yang kamu pilih.", target: 1, xp: 15, metric: "breakfast", href: "/log", unit: "catatan sarapan" },
  { id: "written-trail", title: "Cerita di piring", description: "Simpan satu catatan makanan melalui deskripsi teks.", target: 1, xp: 20, metric: "text", href: "/log/text", unit: "catatan teks" },
  { id: "noon-pages", title: "Jeda tengah hari", description: "Catat makan siangmu hari ini.", target: 1, xp: 15, metric: "lunch", href: "/log", unit: "catatan makan siang" },
  { id: "catalogue-trail", title: "Penelusur katalog", description: "Cari makanan di katalog lalu simpan catatannya.", target: 1, xp: 20, metric: "search", href: "/log/search", unit: "catatan katalog" },
  { id: "evening-pages", title: "Halaman senja", description: "Catat makan malammu hari ini.", target: 1, xp: 15, metric: "dinner", href: "/log", unit: "catatan makan malam" },
  { id: "recipe-trail", title: "Dari buku resep", description: "Simpan satu catatan dari pilihan resep.", target: 1, xp: 25, metric: "recipe", href: "/recipes", unit: "catatan resep" },
  { id: "field-notes", title: "Catatan kecil", description: "Tambahkan keterangan pada salah satu catatan makananmu.", target: 1, xp: 20, metric: "notes", href: "/log", unit: "catatan berketerangan" },
  { id: "camera-trail", title: "Cerita lewat foto", description: "Tinjau hasil foto makanan lalu simpan catatannya.", target: 1, xp: 25, metric: "photo", href: "/log/photo", unit: "catatan foto" },
  { id: "voice-trail", title: "Jurnal bersuara", description: "Tinjau hasil deskripsi suara lalu simpan catatannya.", target: 1, xp: 25, metric: "voice", href: "/log/voice", unit: "catatan suara" }
] as const;
export const optionalQuestLimit = 2;
export function dailyOptionalQuests(day: string) {
  const ordinal = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  if (!Number.isFinite(ordinal)) return [];
  const start = ((ordinal % optionalQuestDefinitions.length) + optionalQuestDefinitions.length) % optionalQuestDefinitions.length;
  return Array.from({ length: 4 }, (_, index) => optionalQuestDefinitions[(start + index) % optionalQuestDefinitions.length]);
}
export type QuestMetrics = { meals: number; types: number; foods: number } & Partial<Record<typeof optionalQuestDefinitions[number]["metric"], number>>;
export function questMetrics(logs: readonly { mealType: string; inputMethod?: string; notes?: string | null }[], foodNames: readonly string[]): QuestMetrics {
  const count = (key: "mealType" | "inputMethod", value: string) => logs.filter(log => log[key] === value).length;
  return { meals: logs.length, types: new Set(logs.map(log => log.mealType)).size, foods: new Set(foodNames.map(name => name.trim().toLocaleLowerCase("id"))).size,
    breakfast: count("mealType", "breakfast"), lunch: count("mealType", "lunch"), dinner: count("mealType", "dinner"),
    text: count("inputMethod", "text"), search: count("inputMethod", "search"), recipe: count("inputMethod", "recipe"), photo: count("inputMethod", "photo"), voice: count("inputMethod", "voice"), notes: logs.filter(log => log.notes?.trim()).length };
}
export function adventureView(day: string, metrics: QuestMetrics, claimed: string[], totalXp: number, equippedReward: string, accepted: string[] = []) {
  const present = (quest: typeof questDefinitions[number] | typeof optionalQuestDefinitions[number], optional: boolean) => {
    const progress = metrics[quest.metric] ?? 0;
    const selected = !optional || accepted.includes(quest.id);
    return { ...quest, optional, accepted: selected, progress: Math.min(quest.target, progress), ready: selected && progress >= quest.target, claimed: claimed.includes(quest.id) };
  };
  return { day, totalXp, level: Math.floor(totalXp / 100) + 1, levelXp: totalXp % 100, equippedReward,
    dailyLogin: { ...dailyLoginDefinition, accepted: true, ready: true, claimed: claimed.includes(dailyLoginDefinition.id) },
    quests: questDefinitions.map(quest => present(quest, false)),
    optionalQuests: dailyOptionalQuests(day).map(quest => present(quest, true)),
    optionalSlotsRemaining: Math.max(0, optionalQuestLimit - accepted.length),
    rewards: rewardDefinitions.map(reward => ({ ...reward, unlocked: totalXp >= reward.xp })) };
}
export type Adventure = ReturnType<typeof adventureView>;
