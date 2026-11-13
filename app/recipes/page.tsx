import Link from "next/link";
import { recipes } from "@/lib/demo/recipes";
import { RecipeCard } from "@/components/recipes/recipe-card";

export default function RecipesPage() {
  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>Resep harian</h1><p>Ide hidangan sederhana untuk sarapan, makan siang, dan makan malam.</p></header>
    <p className="demo-note">Koleksi contoh · Nilai gizi adalah estimasi per porsi, belum disesuaikan dengan kebutuhan pribadimu. Favorit tersimpan selama sesi demo ini.</p>
    <div className="flex flex-wrap gap-3 mb-6"><Link className="ui-btn" href="/targets">Lihat target harian</Link><Link className="ui-btn ui-btn-ghost" href="/log">Catat makanan</Link></div>
    <section aria-labelledby="recipe-list-title">
      <div className="section-title-row"><h2 id="recipe-list-title">Pilihan menu</h2><span>{recipes.length} resep contoh</span></div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((recipe) => <li key={recipe.id}><RecipeCard recipe={recipe} /></li>)}
      </ul>
    </section>
  </div>;
}
