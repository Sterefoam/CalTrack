import { requireUser } from "@/lib/auth/request";
import { InputError, readJson } from "@/lib/http/json";
import { logRecipe } from "@/lib/recipes/log";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  try {
    return Response.json(await logRecipe(identity.userId, (await context.params).id, await readJson(request, 8000)), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof InputError ? error.code : "recipe_log_unavailable" }, { status: error instanceof InputError ? error.status : 500 });
  }
}
