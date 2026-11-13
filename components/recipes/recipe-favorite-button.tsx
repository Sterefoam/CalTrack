"use client";

import { useDashboardState } from "@/components/dashboard/dashboard-state";

export function RecipeFavoriteButton({ id, name }: { id: string; name: string }) {
  const { favoriteRecipeIds, setFavoriteRecipeIds } = useDashboardState();
  const saved = favoriteRecipeIds.includes(id);
  return <button className="ui-btn" type="button" aria-pressed={saved} aria-label={`${saved ? "Hapus" : "Simpan"} ${name} ${saved ? "dari" : "ke"} favorit resep`} onClick={() => setFavoriteRecipeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}>{saved ? "Tersimpan · Hapus favorit" : "Simpan favorit"}</button>;
}
