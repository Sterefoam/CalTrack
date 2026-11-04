import { requireUser } from "@/lib/auth/request";
import { InputError, readJson } from "@/lib/http/json";
import { AnalysisError } from "@/lib/ai/food-analysis";
import { analyzeText } from "@/lib/ai/text";
import { allowAnalysis } from "@/lib/ai/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  if (!allowAnalysis(identity.userId)) return Response.json({ error: "analysis_rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  try {
    const body = await readJson(request, 8000);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("invalid_food_text");
    return Response.json(await analyzeText((body as Record<string, unknown>).text, request.signal), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof InputError || error instanceof AnalysisError;
    return Response.json({ error: known ? error.code : "analysis_unavailable" }, { status: known ? error.status : 500 });
  }
}
