import { NextResponse } from "next/server";
import { createFoodLog, validateFoodLogInput } from "@/lib/food-logs/create-food-log";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/request";
import { InputError, readJson } from "@/lib/http/json";
import { getFoodHistory, parseHistoryQuery } from "@/lib/food-logs/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  try {
    return NextResponse.json(await getFoodHistory(identity.userId, parseHistoryQuery(new URL(request.url).searchParams)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof InputError ? error.code : "food_history_unavailable" }, { status: error instanceof InputError ? error.status : 500 });
  }
}

export async function POST(request: Request) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  const { userId } = identity;

  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof InputError ? error.code : "invalid_json" }, { status: error instanceof InputError ? error.status : 400 });
  }

  const validation = validateFoodLogInput(body);
  if ("error" in validation) {
    return NextResponse.json({ error: "invalid_food_log", message: validation.error }, { status: 400 });
  }

  try {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    const foodLog = await createFoodLog(userId, validation.value);
    return NextResponse.json(foodLog, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal menyimpan catatan makanan", error);
    return NextResponse.json({ error: "food_log_unavailable" }, { status: 500 });
  }
}
