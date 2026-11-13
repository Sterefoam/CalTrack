import { requireUser } from "@/lib/auth/request";
import { InputError } from "@/lib/http/json";
import { listRecipes } from "@/lib/recipes/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  try {
    return Response.json(await listRecipes(identity.userId, new URL(request.url).searchParams), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof InputError ? error.code : "recipes_unavailable" }, { status: error instanceof InputError ? error.status : 500 });
  }
}
