import type { Recipe } from "@/lib/demo/recipes";
import Link from "next/link";
import { RecipeFavoriteButton } from "./recipe-favorite-button";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return <article className="ui-card bg-base-100 h-full" aria-labelledby={`recipe-${recipe.id}`}>
    <div className="ui-card-body p-5">
      <p className="text-sm text-base-content/70">{recipe.meal} · {recipe.minutes} menit</p>
      <h3 id={`recipe-${recipe.id}`} className="ui-card-title text-base">{recipe.name}</h3>
      <p className="text-base-content/70">{recipe.description}</p>
      <p className="mt-3 text-xl tabular-nums font-semibold">{recipe.calories} <span className="text-sm font-normal text-base-content/70">kkal / porsi</span></p>
      <dl className="grid grid-cols-3 gap-3 tabular-nums text-sm border-t border-base-300 pt-3 mt-1">
        <div><dt className="text-base-content/70">Protein</dt><dd className="font-semibold">{recipe.proteinG} g</dd></div>
        <div><dt className="text-base-content/70">Karbo</dt><dd className="font-semibold">{recipe.carbsG} g</dd></div>
        <div><dt className="text-base-content/70">Lemak</dt><dd className="font-semibold">{recipe.fatG} g</dd></div>
      </dl>
      <div className="ui-card-actions mt-3"><Link className="ui-btn ui-btn-ghost" href={`/recipes/${recipe.id}`} aria-label={`Lihat resep ${recipe.name}`}>Lihat resep</Link><RecipeFavoriteButton id={recipe.id} name={recipe.name} /></div>
    </div>
  </article>;
}
