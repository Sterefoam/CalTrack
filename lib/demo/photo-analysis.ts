export const analysisSteps = ["Menyiapkan foto", "Membaca komponen makanan", "Menghitung perkiraan gizi"];

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Dibatalkan", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException("Dibatalkan", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function runDemoPhotoAnalysis(file: File, signal: AbortSignal, onStep: (step: number) => void) {
  if (!file.size || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Foto tidak dapat dianalisis. Pilih gambar yang valid.");
  for (let step = 0; step < analysisSteps.length; step++) {
    onStep(step);
    await delay(650, signal);
  }
}
