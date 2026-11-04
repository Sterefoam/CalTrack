import { and, desc, eq, exists, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { foodLogItems, foodLogs } from "@/db/schema";
import { parseDashboardDate } from "@/lib/dashboard/get-daily-summary";
import { InputError } from "@/lib/http/json";

type Cursor = { at: number; id: string };
export function parseHistoryQuery(params: URLSearchParams) {
  const day = parseDashboardDate(params.get("date"), params.get("timeZone") ?? "Asia/Jakarta");
  const limit = params.get("limit") ?? "20";
  const mealType = params.get("mealType");
  const query = params.get("q")?.trim() ?? "";
  if (!day || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 50 || query.length > 120 || (mealType && !["breakfast", "lunch", "dinner", "snack"].includes(mealType))) throw new InputError("invalid_history_query");
  let cursor: Cursor | undefined;
  const rawCursor = params.get("cursor");
  if (rawCursor) {
    try {
      if (rawCursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(rawCursor)) throw new Error();
      const value = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
      if (!Number.isSafeInteger(value.at) || Math.abs(value.at) > 8.64e15 || typeof value.id !== "string" || !value.id || value.id.length > 128) throw new Error();
      cursor = value;
    } catch { throw new InputError("invalid_history_cursor"); }
  }
  return { day, limit: Number(limit), mealType: mealType as "breakfast" | "lunch" | "dinner" | "snack" | null, query, cursor };
}

export async function getFoodHistory(userId: string, options: ReturnType<typeof parseHistoryQuery>, database = db) {
  const { day, limit, mealType, query, cursor } = options;
  const where = and(eq(foodLogs.userId, userId), gte(foodLogs.loggedAt, day.start), lt(foodLogs.loggedAt, day.end), mealType ? eq(foodLogs.mealType, mealType) : undefined,
    query ? exists(database.select({ id: foodLogItems.id }).from(foodLogItems).where(and(eq(foodLogItems.foodLogId, foodLogs.id), sql`instr(lower(${foodLogItems.foodName}), ${query.toLowerCase()}) > 0`))) : undefined);
  const [summary] = await database.select({ count: sql<number>`count(*)`.mapWith(Number), calories: sql<number>`coalesce(sum(${foodLogs.totalCalories}), 0)`.mapWith(Number) }).from(foodLogs).where(where);
  const entries = await database.select().from(foodLogs).where(and(where, cursor ? or(lt(foodLogs.loggedAt, new Date(cursor.at)), and(eq(foodLogs.loggedAt, new Date(cursor.at)), lt(foodLogs.id, cursor.id))) : undefined)).orderBy(desc(foodLogs.loggedAt), desc(foodLogs.id)).limit(limit + 1);
  const page = entries.slice(0, limit);
  const items = page.length ? await database.select().from(foodLogItems).where(inArray(foodLogItems.foodLogId, page.map(log => log.id))).orderBy(foodLogItems.id) : [];
  const last = page.at(-1);
  return {
    date: day.date, timeZone: day.timeZone, summary,
    logs: page.map(log => ({ ...log, rawAiResponse: undefined, items: items.filter(item => item.foodLogId === log.id) })),
    nextCursor: entries.length > limit && last ? Buffer.from(JSON.stringify({ at: last.loggedAt.getTime(), id: last.id })).toString("base64url") : null
  };
}
