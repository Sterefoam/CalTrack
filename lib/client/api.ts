import { localDateString } from "@/lib/demo/local-date";
import type { DemoFoodLog, FoodItem, MealType } from "@/lib/demo/nutrition-data";
import type { PhotoWeightAssessment } from "@/lib/ai/photo-reference";

const messages: Record<string, string> = {
  chat_unavailable: "Luna belum dapat tersambung ke mesin AI. Periksa apakah model di server sudah berjalan, lalu coba lagi.",
  chat_timeout: "Luna membutuhkan waktu lebih lama. Pesan belum disimpan; coba lagi dalam percakapan ini.",
  chat_busy: "Luna sedang menjawab percakapan lain. Tunggu beberapa detik lalu kirim ulang; pesanmu tetap ada.",
  invalid_chat_response: "Jawaban AI belum lengkap. Coba pertanyaan yang lebih singkat.",
  conversation_limit: "Percakapan sudah penuh. Mulai percakapan baru untuk melanjutkan.",
  quest_not_ready: "Quest belum selesai. Lengkapi catatan yang diminta lalu perbarui progres.",
  reward_locked: "Hadiah ini belum terbuka. Kumpulkan XP dari quest lebih dahulu.",
  quest_not_accepted: "Pilih quest opsional ini lebih dahulu sebelum mengambil XP.",
  quest_slots_full: "Dua pilihan quest hari ini sudah terisi. Pilihan baru tersedia besok.",
  invalid_quest: "Quest ini tidak tersedia hari ini. Perbarui papan quest.",
  authentication_required: "Sesi akun berakhir. Masuk kembali sebelum menyimpan.",
  ai_not_configured: "Layanan AI belum dikonfigurasi. Gunakan input gizi manual.",
  ai_unavailable: "Layanan AI sedang tidak tersedia. Coba lagi atau isi secara manual.",
  no_food_detected: "Makanan belum terdeteksi. Coba foto atau deskripsi yang lebih jelas.",
  analysis_rate_limited: "Terlalu banyak analisis. Tunggu sebentar lalu coba lagi.",
  ai_rate_limited: "Layanan AI sedang membatasi permintaan. Coba lagi nanti.",
  analysis_timeout: "Analisis terlalu lama. Coba lagi.",
  invalid_photo_reference: "Periksa ukuran pembanding yang dimasukkan.",
  reference_not_visible: "Batas piring belum terlihat jelas. Ambil ulang foto yang menampilkan seluruh piring.",
  no_nutrition_label: "Tabel nutrisi belum ditemukan. Ambil foto lebih dekat dengan seluruh tabel terlihat.",
  invalid_label_response: "Angka pada label belum dapat dibaca dengan aman. Coba foto yang lebih jelas atau isi manual.",
  label_unavailable: "Pembaca label belum tersedia. Coba lagi atau isi gizi secara manual.",
  invalid_label_language: "Pilih bahasa label dari pilihan yang tersedia.",
  ocr_not_prepared: "Paket bahasa pembaca lokal belum disiapkan di server. Gunakan pembaca AI atau isi secara manual.",
};
export async function api<T>(path: string, options: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store", signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) }); }
  catch (error) { if (options.signal?.aborted) throw error; throw new Error("Koneksi ke server gagal. Periksa riwayat sebelum mengulangi penyimpanan untuk menghindari catatan ganda."); }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(messages[data?.error] ?? (response.status === 401 ? messages.authentication_required : "Permintaan belum berhasil. Coba lagi; catatanmu tetap ada di formulir."));
  return data as T;
}
export const jsonRequest = (method: string, value: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
export type FoodLogResponse = { id: string; loggedAt: string; mealType: MealType; items: FoodItem[] };
export function toClientLog(log: FoodLogResponse): DemoFoodLog {
  const at = new Date(log.loggedAt);
  return { id: log.id, date: localDateString(at), time: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`, mealType: log.mealType, items: log.items };
}
export async function loadFoodHistory(date: string, signal?: AbortSignal) {
  const logs: DemoFoodLog[] = [];
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ date, timeZone: browserTimeZone(), limit: "50", ...(cursor ? { cursor } : {}) });
    const page: { logs: FoodLogResponse[]; nextCursor: string | null } = await api(`/api/food-logs?${params}`, { signal });
    logs.push(...page.logs.map(toClientLog));
    cursor = page.nextCursor;
  } while (cursor);
  return logs;
}
export type AnalysisResponse = { items: FoodItem[]; confidenceScore: number | null; transcript?: string; photoAssessment?: PhotoWeightAssessment };
