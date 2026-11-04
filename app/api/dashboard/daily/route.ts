import { NextResponse } from "next/server";
import { getDailySummary, parseDashboardDate, UserNotFoundError } from "@/lib/dashboard/get-daily-summary";
import { requireUser } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  const { userId } = identity;

  const timeZone = url.searchParams.get("timeZone") ?? "Asia/Jakarta";
  const day = parseDashboardDate(url.searchParams.get("date"), timeZone);
  if (!day) {
    return NextResponse.json({ error: "invalid_date_or_time_zone", message: "Gunakan tanggal YYYY-MM-DD dan zona waktu IANA yang valid." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getDailySummary(userId, day), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    console.error("Gagal mengambil ringkasan dashboard harian", error);
    return NextResponse.json({ error: "daily_summary_unavailable" }, { status: 500 });
  }
}
