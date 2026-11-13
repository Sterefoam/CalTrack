import { and, desc, eq, exists, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { favoriteItems, favorites } from "@/db/schema";
import type { CreateFoodLogInput } from "@/lib/food-logs/create-food-log";
import { InputError } from "@/lib/http/json";

type FavoriteInput = Pick<CreateFoodLogInput, "inputMethod" | "items">;
export function parseFavoriteQuery(params: URLSearchParams) {
  const query = params.get("q")?.trim().toLowerCase() ?? "";
  const limit = params.get("limit") ?? "20";
  if (query.length > 120 || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 50) throw new InputError("invalid_favorite_query");
  let cursor: { at: number; id: string } | undefined;
  const raw = params.get("cursor");
  if (raw) {
    try {
      if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
      const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
      if (!Number.isSafeInteger(value.at) || Math.abs(value.at) > 8.64e15 || typeof value.id !== "string" || !value.id || value.id.length > 128) throw new Error();
      cursor = value;
    } catch { throw new InputError("invalid_favorite_cursor"); }
  }
  return { query, limit: Number(limit), cursor };
}

export async function listFavorites(userId: string, options: ReturnType<typeof parseFavoriteQuery>, database = db) {
  const { query, limit, cursor } = options;
  const rows = await database.select().from(favorites).where(and(
    eq(favorites.userId, userId),
    query ? exists(database.select({ id: favoriteItems.id }).from(favoriteItems).where(and(eq(favoriteItems.favoriteId, favorites.id), sql`instr(lower(${favoriteItems.foodName}), ${query}) > 0`))) : undefined,
    cursor ? or(lt(favorites.createdAt, new Date(cursor.at)), and(eq(favorites.createdAt, new Date(cursor.at)), lt(favorites.id, cursor.id))) : undefined
  )).orderBy(desc(favorites.createdAt), desc(favorites.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const items = page.length ? await database.select().from(favoriteItems).where(inArray(favoriteItems.favoriteId, page.map(row => row.id))).orderBy(favoriteItems.position) : [];
  const last = page.at(-1);
  return {
    favorites: page.map(row => ({ id: row.id, inputMethod: row.inputMethod, createdAt: row.createdAt, items: items.filter(item => item.favoriteId === row.id).map(({ favoriteId: _parent, position: _position, ...item }) => item) })),
    nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ at: last.createdAt.getTime(), id: last.id })).toString("base64url") : null
  };
}

export async function saveFavorite(userId: string, input: FavoriteInput, database = db) {
  return database.transaction(async tx => {
    const [favorite] = await tx.insert(favorites).values({ userId, inputMethod: input.inputMethod }).returning();
    const items = await tx.insert(favoriteItems).values(input.items.map((item, position) => ({ ...item, favoriteId: favorite.id, position }))).returning();
    return { id: favorite.id, inputMethod: favorite.inputMethod, createdAt: favorite.createdAt, items: items.map(({ favoriteId: _parent, position: _position, ...item }) => item) };
  });
}

export async function deleteFavorite(userId: string, id: string, database = db) {
  const rows = await database.delete(favorites).where(and(eq(favorites.id, id), eq(favorites.userId, userId))).returning({ id: favorites.id });
  if (!rows.length) throw new InputError("favorite_not_found", 404);
}
