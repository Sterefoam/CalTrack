import { requireUser } from "@/lib/auth/request";
import { lookupBarcode } from "@/lib/foods/catalog";
import { InputError } from "@/lib/http/json";
import { allowAnalysis } from "@/lib/ai/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  if (!allowAnalysis(`barcode:${identity.userId}`)) return Response.json({ error: "barcode_rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  try { return Response.json(await lookupBarcode((await context.params).code, request.signal), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof InputError ? error.code : "food_lookup_unavailable" }, { status: error instanceof InputError ? error.status : 500 }); }
}
