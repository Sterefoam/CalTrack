import { examplePhotoItems } from "@/lib/demo/photo-result";
import type { FoodItem } from "@/lib/demo/nutrition-data";

export type VoiceAnalysisRequest = { audio: Blob };
export type VoiceAnalysisResponse = { items: FoodItem[]; confidenceScore: number | null };

// Respons stub untuk layer frontend; belum mengirim audio ke layanan transkripsi.
export async function analyzeFoodVoice({ audio }: VoiceAnalysisRequest, signal: AbortSignal): Promise<VoiceAnalysisResponse> {
  if (!audio.size || audio.size > 10 * 1024 * 1024 || !audio.type.startsWith("audio/")) throw new Error("Pilih rekaman audio yang valid, maksimal 10 MB.");
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Dibatalkan", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException("Dibatalkan", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 1000);
    signal.addEventListener("abort", abort, { once: true });
  });
  return { items: structuredClone(examplePhotoItems), confidenceScore: null };
}
