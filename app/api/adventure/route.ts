import { requireUser } from "@/lib/auth/request";
import { InputError, readJson } from "@/lib/http/json";
import { claimQuest, equipReward, getAdventure } from "@/lib/adventure/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try { return Response.json(await getAdventure(identity.userId), { headers }); } catch { return Response.json({ error: "adventure_unavailable" }, { status: 503 }); }
}
export async function POST(request: Request) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try {
    const input = await readJson(request, 2000) as Record<string, unknown>;
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new InputError("invalid_action");
    if (input.action !== "claim" && input.action !== "equip") throw new InputError("invalid_action");
    return Response.json(input.action === "claim" ? await claimQuest(identity.userId, input.questId) : await equipReward(identity.userId, input.rewardId), { headers });
  } catch (error) { return Response.json({ error: error instanceof InputError ? error.code : "adventure_unavailable" }, { status: error instanceof InputError ? error.status : 503 }); }
}
