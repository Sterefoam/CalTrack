import sharp from "sharp";
import { AnalysisError, requestFoodAnalysis } from "./food-analysis";

export async function normalizePhoto(file: File) {
  if (!file.size || file.size > 10 * 1024 * 1024) throw new AnalysisError("invalid_photo_size", 413);
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!formats[file.type]) throw new AnalysisError("unsupported_photo", 415);
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await image.metadata();
    if (metadata.format !== formats[file.type] || (metadata.pages ?? 1) !== 1) throw new Error("invalid_image");
    // Re-encoding strips EXIF/GPS metadata and bounds the image sent to the provider.
    return await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch { throw new AnalysisError("invalid_photo", 400); }
}

export async function analyzePhoto(file: File, signal: AbortSignal, options?: Parameters<typeof requestFoodAnalysis>[2]) {
  const image = await normalizePhoto(file);
  return requestFoodAnalysis([{ type: "text", text: "Identifikasi makanan dan estimasi gizi dari foto ini." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image.toString("base64")}`, detail: "auto" } }], signal, options);
}
