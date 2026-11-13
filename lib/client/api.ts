import { localDateString } from "@/lib/demo/local-date";
import type { DemoFoodLog, FoodItem, MealType } from "@/lib/demo/nutrition-data";
import type { PhotoWeightAssessment } from "@/lib/ai/photo-reference";

const messages: Record<string, string> = {
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
};
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store", signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) }); }
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
