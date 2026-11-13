import { requireUser } from "@/lib/auth/request";
import { InputError, readJson } from "@/lib/http/json";
import { validateFoodLogInput } from "@/lib/food-logs/create-food-log";
import { resolveCatalogPortions } from "@/lib/foods/portions";
import { deleteFoodLog, FoodLogNotFound, getFoodLog, updateFoodLog } from "@/lib/food-logs/update-food-log";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  return Response.json({ error: error instanceof FoodLogNotFound ? "food_log_not_found" : error instanceof InputError ? error.code : "food_log_unavailable" }, { status: error instanceof FoodLogNotFound ? 404 : error instanceof InputError ? error.status : 500 });
}
export async function GET(request: Request, context: Context) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try { return Response.json(await getFoodLog(identity.userId, (await context.params).id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request, context: Context) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try {
    const id = (await context.params).id;
    const current = await getFoodLog(identity.userId, id);
    const body = await resolveCatalogPortions(await readJson(request));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("invalid_food_log");
    const input = validateFoodLogInput({ ...current, loggedAt: current.loggedAt.toISOString(), ...body });
    if ("error" in input) return Response.json({ error: "invalid_food_log", message: input.error }, { status: 400 });
    return Response.json(await updateFoodLog(identity.userId, id, input.value), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request, context: Context) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  try { await deleteFoodLog(identity.userId, (await context.params).id); return new Response(null, { status: 204 }); }
  catch (error) { return failure(error); }
}
