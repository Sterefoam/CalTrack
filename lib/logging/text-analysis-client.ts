import type { FoodItem, MealType } from "@/lib/demo/nutrition-data";
import { examplePhotoItems } from "@/lib/demo/photo-result";

export type TextAnalysisRequest = { text: string; mealType: MealType };
export type TextAnalysisResponse = { items: FoodItem[]; confidenceScore: number | null };

// Adapter frontend demo. Transport API diganti pada layer backend tanpa mengubah form.
export async function analyzeFoodText(request: TextAnalysisRequest, signal: AbortSignal): Promise<TextAnalysisResponse> {
  const text = request.text.trim();
  if (text.length < 3 || text.length > 1000) throw new Error("Tulis cerita makanan sepanjang 3–1.000 karakter.");
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Dibatalkan", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException("Dibatalkan", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 800);
    signal.addEventListener("abort", abort, { once: true });
  });
  return { items: structuredClone(examplePhotoItems), confidenceScore: null };
}
