import { requireUser } from "@/lib/auth/request";
import { InputError, readJson } from "@/lib/http/json";
import { AnalysisError } from "@/lib/ai/food-analysis";
import { allowAnalysis } from "@/lib/ai/rate-limit";
import { listConversations, readConversation, sendNutritionMessage } from "@/lib/chat/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try {
    const id = new URL(request.url).searchParams.get("conversationId");
    if (id && id.length > 128) throw new InputError("invalid_conversation_id");
    return Response.json(id ? await readConversation(identity.userId, id) : { conversations: await listConversations(identity.userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  if (!allowAnalysis(identity.userId)) return Response.json({ error: "analysis_rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  try { return Response.json(await sendNutritionMessage(identity.userId, await readJson(request, 8000), request.signal), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
function failure(error: unknown) {
  const known = error instanceof InputError || error instanceof AnalysisError;
  return Response.json({ error: known ? error.code : "chat_unavailable" }, { status: known ? error.status : 500 });
}
