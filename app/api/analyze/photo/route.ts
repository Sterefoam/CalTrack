import { requireUser } from "@/lib/auth/request";
import { readMultipart } from "@/lib/http/multipart";
import { InputError } from "@/lib/http/json";
import { AnalysisError } from "@/lib/ai/food-analysis";
import { analyzePhoto } from "@/lib/ai/photo";
import { allowAnalysis } from "@/lib/ai/rate-limit";
import { parsePhotoReference } from "@/lib/ai/photo-reference";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  if (!allowAnalysis(identity.userId)) return Response.json({ error: "analysis_rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  try {
    const form = await readMultipart(request);
    const photo = form.get("photo");
    if (!(photo instanceof File) || form.getAll("photo").length !== 1) throw new InputError("photo_required");
    if (form.getAll("reference").length > 1) throw new InputError("invalid_photo_reference");
    const reference = parsePhotoReference(form.get("reference"));
    return Response.json(await analyzePhoto(photo, request.signal,{ reference }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof InputError || error instanceof AnalysisError;
    return Response.json({ error: known ? error.code : "analysis_unavailable" }, { status: known ? error.status : 500 });
  }
}
