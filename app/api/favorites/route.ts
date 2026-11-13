import { requireUser } from "@/lib/auth/request";
import { validateFoodLogInput } from "@/lib/food-logs/create-food-log";
import { listFavorites, parseFavoriteQuery, saveFavorite } from "@/lib/foods/favorites";
import { resolveCatalogPortions } from "@/lib/foods/portions";
import { InputError, readJson } from "@/lib/http/json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  return Response.json({ error: error instanceof InputError ? error.code : "favorites_unavailable" }, { status: error instanceof InputError ? error.status : 500 });
}
export async function GET(request: Request) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try { return Response.json(await listFavorites(identity.userId, parseFavoriteQuery(new URL(request.url).searchParams)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try {
    const body = await resolveCatalogPortions(await readJson(request));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("invalid_favorite");
    const { inputMethod, items } = body as Record<string, unknown>;
    const validation = validateFoodLogInput({ mealType: "snack", inputMethod, items });
    if ("error" in validation) return Response.json({ error: "invalid_favorite", message: validation.error }, { status: 400 });
    return Response.json(await saveFavorite(identity.userId, validation.value), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
