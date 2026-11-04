import { requireUser } from "@/lib/auth/request";
import { searchFoods } from "@/lib/foods/catalog";
import { InputError } from "@/lib/http/json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const identity = await requireUser(request); if (identity instanceof Response) return identity;
  const query = new URL(request.url).searchParams;
  try { return Response.json({ foods: await searchFoods(query.get("q") ?? "", Number(query.get("limit") ?? 20)) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof InputError ? error.code : "food_search_unavailable" }, { status: error instanceof InputError ? error.status : 500 }); }
}
