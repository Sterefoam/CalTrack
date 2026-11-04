import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { exerciseLogs, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  const { userId } = identity;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body)) return NextResponse.json({ error: "invalid_exercise_log" }, { status: 400 });

  const activityName = typeof body.activityName === "string" ? body.activityName.trim() : "";
  const durationMinutes = body.durationMinutes;
  const caloriesBurned = body.caloriesBurned;
  if (activityName.length < 1 || activityName.length > 100) {
    return NextResponse.json({ error: "invalid_activity_name", message: "Nama aktivitas harus 1–100 karakter." }, { status: 400 });
  }
  if (typeof durationMinutes !== "number" || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    return NextResponse.json({ error: "invalid_duration", message: "Durasi harus berupa bilangan bulat antara 1 dan 1.440 menit." }, { status: 400 });
  }
  if (typeof caloriesBurned !== "number" || !Number.isFinite(caloriesBurned) || caloriesBurned < 0 || caloriesBurned > 20000) {
    return NextResponse.json({ error: "invalid_calories", message: "Kalori terbakar harus antara 0 dan 20.000 kkal." }, { status: 400 });
  }

  let loggedAt = new Date();
  if (body.loggedAt !== undefined) {
    if (typeof body.loggedAt !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(body.loggedAt)) {
      return NextResponse.json({ error: "invalid_logged_at", message: "loggedAt harus berupa waktu ISO dengan zona waktu." }, { status: 400 });
    }
    loggedAt = new Date(body.loggedAt);
    if (Number.isNaN(loggedAt.getTime())) return NextResponse.json({ error: "invalid_logged_at" }, { status: 400 });
  }

  try {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    const [entry] = await db.insert(exerciseLogs).values({
      userId,
      activityName,
      durationMinutes,
      caloriesBurned,
      loggedAt
    }).returning({ id: exerciseLogs.id, activityName: exerciseLogs.activityName, durationMinutes: exerciseLogs.durationMinutes, caloriesBurned: exerciseLogs.caloriesBurned, loggedAt: exerciseLogs.loggedAt });

    return NextResponse.json(entry, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal menyimpan catatan olahraga", error);
    return NextResponse.json({ error: "exercise_log_unavailable" }, { status: 500 });
  }
}
