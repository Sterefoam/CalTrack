import { requireUser } from "@/lib/auth/request";
import { InputError } from "@/lib/http/json";
import { saveRecipeFavorite, deleteRecipeFavorite } from "@/lib/recipes/favorites";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  try { return Response.json(await saveRecipeFavorite(identity.userId, (await context.params).id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
export async function DELETE(request: Request, context: Context) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  try { await deleteRecipeFavorite(identity.userId, (await context.params).id); return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
function failure(error: unknown) {
  return Response.json({ error: error instanceof InputError ? error.code : "recipe_favorite_unavailable" }, { status: error instanceof InputError ? error.status : 500 });
}
