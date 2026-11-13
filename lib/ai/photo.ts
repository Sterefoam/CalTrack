import sharp from "sharp";
import { AnalysisError, requestFoodAnalysis } from "./food-analysis";
import { parsePhotoReference, parseReferencedPhoto, referencedPhotoSchema, type PhotoReference } from "./photo-reference";
import { requestVisionJson } from "./vision-request";

export async function normalizePhoto(file: File, maxEdge = 1600) {
  if (!file.size || file.size > 10 * 1024 * 1024) throw new AnalysisError("invalid_photo_size", 413);
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!formats[file.type]) throw new AnalysisError("unsupported_photo", 415);
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await image.metadata();
    if (metadata.format !== formats[file.type] || (metadata.pages ?? 1) !== 1) throw new Error("invalid_image");
    // Re-encoding strips EXIF/GPS metadata and bounds the image sent to the provider.
    return await image.rotate().resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  } catch { throw new AnalysisError("invalid_photo", 400); }
}

export async function analyzePhoto(file: File, signal: AbortSignal, options?: Parameters<typeof requestFoodAnalysis>[2] & { reference?: PhotoReference }) {
  const reference = parsePhotoReference(options?.reference);
  const image = await normalizePhoto(file);
  if (reference) {
    const instruction = "Identifikasi komponen makanan dan estimasi gizi porsi dalam Bahasa Indonesia. Gram, kkal, natrium mg. Ini estimasi visual, bukan penimbangan. " +
      (reference.kind === "plate_diameter_cm" ? `Pengguna menyatakan diameter piring ${reference.value} cm. Gunakan skala ini hanya bila seluruh batas piring tampak. Nyatakan reference_visible=false bila acuan tidak terlihat. Ketebalan dan densitas belum diketahui; beri rentang berat yang jujur dan catatan asumsi.` : `Pengguna mengetahui berat total seluruh makanan yang dimakan dalam foto: ${reference.value} gram. Bagi berat antarkomponen sesuai tampilan; jangan menyertakan berat piring/kemasan. reference_visible boleh false karena berat total diberikan pengguna.`) +
      " weight_ranges harus seurut dan sejumlah items; lower_grams <= estimated_weight_grams <= upper_grams. Rentang adalah perkiraan yang belum terkalibrasi, bukan interval jaminan statistik. Jangan menyatakan gram pasti dari tampilan. Jangan mengarang komponen yang tidak terlihat.";
    return parseReferencedPhoto(await requestVisionJson(image,instruction,referencedPhotoSchema,signal,options),reference);
  }
  return requestFoodAnalysis([{ type: "text", text: "Identifikasi makanan dan estimasi gizi dari foto ini." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image.toString("base64")}`, detail: "auto" } }], signal, options);
}
