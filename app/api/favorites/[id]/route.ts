import { requireUser } from "@/lib/auth/request";
import { deleteFavorite } from "@/lib/foods/favorites";
import { InputError } from "@/lib/http/json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try { await deleteFavorite(identity.userId, (await context.params).id); return new Response(null, { status: 204 }); }
  catch (error) { return Response.json({ error: error instanceof InputError ? error.code : "favorites_unavailable" }, { status: error instanceof InputError ? error.status : 500 }); }
}
