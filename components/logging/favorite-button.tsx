"use client";

import { useDashboardState } from "@/components/dashboard/dashboard-state";
import type { FoodItem } from "@/lib/demo/nutrition-data";
import type { InputMethod } from "@/lib/logging/food-draft";
import { sameFoodItems } from "@/lib/logging/favorite-food";

export function FavoriteButton({ items, inputMethod }: { items: FoodItem[]; inputMethod: InputMethod }) {
  const { favorites, addFavorite, removeFavorite } = useDashboardState();
  const existing = favorites.find((favorite) => sameFoodItems(favorite.items, items));
  return <button type="button" className="ui-btn w-full mt-4" aria-pressed={!!existing} onClick={() => existing ? removeFavorite(existing.id) : addFavorite({ inputMethod, items })}>{existing ? "Hapus dari favorit" : "Simpan ke favorit"}</button>;
}
