import { access } from "node:fs/promises";
import { join } from "node:path";
import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import { normalizePhoto } from "./photo";
import { AnalysisError } from "./food-analysis";
import { isLabelLanguage, type LabelLanguage } from "@/lib/nutrition/label-languages";
import { parseLabelReadings } from "@/lib/nutrition/label-text";

let active = 0;
export async function recognizeLocalLabel(file: File, language: LabelLanguage, signal: AbortSignal) {
  if (!isLabelLanguage(language)) throw new AnalysisError("invalid_label_language", 400);
  if (signal.aborted) throw new AnalysisError("analysis_cancelled", 499);
  const directory = join(process.cwd(), ".caltrack", "ocr");
  const languages = [language];
  try { await Promise.all(languages.map(code => access(join(directory, `${code}.traineddata`)))); } catch { throw new AnalysisError("ocr_not_prepared", 503); }
  if (signal.aborted) throw new AnalysisError("analysis_cancelled", 499);
  if (active >= 2) throw new AnalysisError("analysis_rate_limited", 429);
  active++;
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  const combined = AbortSignal.any([signal, AbortSignal.timeout(25000)]);
  let rejectAbort: (error: Error) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  // The caller may cancel while image decoding is still running, before the first race.
  void aborted.catch(() => {});
  const cancel = () => rejectAbort(new AnalysisError(signal.aborted ? "analysis_cancelled" : "analysis_timeout", signal.aborted ? 499 : 504));
  combined.addEventListener("abort", cancel, { once: true });
  try {
    const normalized = await normalizePhoto(file, 2400);
    const metadata = await sharp(normalized).metadata();
    const edge = Math.max(metadata.width!, metadata.height!);
    const size = Math.round(edge * Math.max(1, Math.min(4, 1200 / edge)));
    const image = await sharp(normalized).resize({ width: size, height: size, fit: "inside" }).greyscale().normalize().png().toBuffer();
    combined.throwIfAborted();
    const initializing = createWorker(languages, 1, { langPath: directory, cachePath: directory, gzip: false, cacheMethod: "readOnly", errorHandler: () => {} });
    void initializing.then(created => { worker = created; if (combined.aborted) void created.terminate(); }, () => {});
    worker = await Promise.race([initializing, aborted]);
    combined.throwIfAborted();
    await Promise.race([worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" }), aborted]);
    const primary = await Promise.race([worker.recognize(normalized), aborted]);
    const secondary = await Promise.race([worker.recognize(image, { rotateAuto: true }), aborted]);
    combined.throwIfAborted();
    const readings = [{ text: primary.data.text, confidence: primary.data.confidence }];
    // Auto-deskew can be unreliable on curved packaging. Discard rotations above 10 degrees.
    if (Math.abs(secondary.data.rotateRadians ?? 0) <= Math.PI / 18) readings.push({ text: secondary.data.text, confidence: secondary.data.confidence });
    return readings;
  } catch (error) {
    if (combined.aborted) throw new AnalysisError(signal.aborted ? "analysis_cancelled" : "analysis_timeout", signal.aborted ? 499 : 504);
    throw error;
  } finally {
    combined.removeEventListener("abort", cancel);
    try { await worker?.terminate(); } catch { /* The worker can already be stopped by cancellation. */ } finally { active--; }
  }
}

export async function analyzeLocalLabel(file: File, language: LabelLanguage, signal: AbortSignal) {
  return parseLabelReadings(await recognizeLocalLabel(file, language, signal), language);
}
