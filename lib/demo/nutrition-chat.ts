import { formatNumber } from "./nutrition-data";

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; time: string };
export type ChatContext = { remainingCalories: number; proteinG: number; proteinTarget: number; waterMl: number; waterTarget: number };

export function demoNutritionReply(question: string, context: ChatContext): string {
  const text = question.toLocaleLowerCase("id-ID");
  const balance = context.remainingCalories >= 0 ? `Sisa kalori pada ringkasanmu ${formatNumber(context.remainingCalories)} kkal.` : `Asupan pada ringkasanmu melewati target sebesar ${formatNumber(Math.abs(context.remainingCalories))} kkal. Target adalah panduan; tidak perlu melewatkan makan untuk mengimbanginya.`;
  if (/air|minum|hidrasi/.test(text)) return `Air minum tercatat ${formatNumber(context.waterMl)} dari ${formatNumber(context.waterTarget)} ml. Coba minum secara berkala sesuai kebutuhan dan aktivitasmu. Kamu dapat mencatat tambahan air di dashboard.`;
  if (/protein|lauk/.test(text)) return `Protein tercatat ${formatNumber(context.proteinG)} dari target contoh ${formatNumber(context.proteinTarget)} g. Ayam, telur, tempe, dan tahu bisa menjadi variasi sumber protein. Cek porsi di katalog sebelum mencatatnya.`;
  if (/makan|menu|kalori|saran/.test(text)) return `${balance} Sebagai contoh menu, padukan sumber karbohidrat, lauk berprotein, dan sayur. Nasi putih 100 g dan dada ayam 100 g pada katalog contoh berjumlah 295 kkal, sebelum sayur atau pelengkap. Sesuaikan porsi dengan rasa lapar dan kebutuhanmu.`;
  return `${balance} Ini balasan demo berbasis aturan, belum percakapan dengan AI. Coba tanyakan contoh menu, sumber protein, atau progres minum untuk melihat tanggapan yang memakai ringkasan harianmu.`;
}
