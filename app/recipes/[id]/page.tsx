import Link from "next/link";
import { notFound } from "next/navigation";
import { recipes } from "@/lib/demo/recipes";
import { recipeDetails } from "@/lib/demo/recipe-details";
import { RecipeFavoriteButton } from "@/components/recipes/recipe-favorite-button";
import { RecipeLogForm } from "@/components/recipes/recipe-log-form";

export function generateStaticParams() { return recipes.map(({ id }) => ({ id })); }

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = recipes.find((item) => item.id === id);
  const detail = Object.hasOwn(recipeDetails, id) ? recipeDetails[id] : undefined;
  if (!recipe || !detail) notFound();
  return <div className="content-wrap logging-page">
    <Link className="ui-btn ui-btn-ghost mb-6" href="/recipes">Kembali ke resep harian</Link>
    <header className="page-heading"><h1>{recipe.name}</h1><p>{recipe.description}</p></header>
    <p className="demo-note">Resep contoh · 1 porsi · {recipe.minutes} menit. Nilai gizi berupa estimasi dan dapat berubah sesuai bahan serta cara memasak.</p>
    <div className="mb-6"><RecipeFavoriteButton id={recipe.id} name={recipe.name} /><p className="field-help mt-2">Favorit resep tersimpan selama sesi demo ini.</p></div>
    <section className="surface-panel mb-6" aria-label="Estimasi gizi per porsi">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-5 tabular-nums">{[["Kalori", `${recipe.calories} kkal`], ["Protein", `${recipe.proteinG} g`], ["Karbohidrat", `${recipe.carbsG} g`], ["Lemak", `${recipe.fatG} g`]].map(([label, value]) => <div key={label}><dt className="text-base-content/70">{label}</dt><dd className="text-xl font-semibold mt-1">{value}</dd></div>)}</dl>
    </section>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
      <section className="surface-panel"><h2>Bahan untuk 1 porsi</h2><ul className="list-disc pl-5 space-y-3 mt-5">{detail.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul><p className="field-help mt-5">Alergen: {detail.allergens}</p></section>
      <section className="surface-panel"><h2>Cara memasak</h2><ol className="list-decimal pl-5 space-y-4 mt-5">{detail.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
    </div>
    <RecipeLogForm recipe={recipe} />
  </div>;
}
