type MacroChartProps = {
  proteinGrams: number;
  proteinTarget: number;
  carbsGrams: number;
  carbsTarget: number;
  fatGrams: number;
  fatTarget: number;
  onDetails?: () => void;
};

export function MacroChart({ proteinGrams, proteinTarget, carbsGrams, carbsTarget, fatGrams, fatTarget, onDetails }: MacroChartProps) {
  const proteinCalories = proteinGrams * 4;
  const carbsCalories = carbsGrams * 4;
  const fatCalories = fatGrams * 9;
  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories || 1;
  const proteinShare = Math.round((proteinCalories / totalMacroCalories) * 100);
  const carbsShare = Math.round((carbsCalories / totalMacroCalories) * 100);
  const fatShare = Math.max(0, 100 - proteinShare - carbsShare);
  const averageGoal = Math.round(((proteinGrams / proteinTarget) + (carbsGrams / carbsTarget) + (fatGrams / fatTarget)) / 3 * 100);
  const macros = [
    { name: "Protein", grams: proteinGrams, target: proteinTarget, share: proteinShare, color: "protein", fill: "protein-fill" },
    { name: "Karbo", grams: carbsGrams, target: carbsTarget, share: carbsShare, color: "carbs", fill: "carbs-fill" },
    { name: "Lemak", grams: fatGrams, target: fatTarget, share: fatShare, color: "fat", fill: "fat-fill" }
  ];
  const proteinEnd = proteinShare;
  const carbsEnd = proteinShare + carbsShare;

  return (
    <article className="macro-card panel-card">
      <div className="section-title-row"><div><div className="card-kicker">Asupan harian</div><h2>Makronutrisi</h2></div><button className="text-button" onClick={onDetails}>Detail <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button></div>
      <div className="macro-chart-wrap">
        <div className="macro-donut" role="img" aria-label={`Komposisi makro: protein ${proteinShare} persen, karbohidrat ${carbsShare} persen, lemak ${fatShare} persen`}><svg className="ring-chart" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#e99c7e" strokeWidth="12" /><circle cx="50" cy="50" r="40" fill="none" stroke="#d6b66e" strokeWidth="12" pathLength="100" strokeDasharray={`${carbsEnd} 100`} transform="rotate(-90 50 50)" /><circle cx="50" cy="50" r="40" fill="none" stroke="#689d76" strokeWidth="12" pathLength="100" strokeDasharray={`${proteinEnd} 100`} transform="rotate(-90 50 50)" /></svg><div className="donut-center"><strong>{averageGoal}<span>%</span></strong><small>rata-rata target</small></div></div>
        <div className="macro-legend">
          {macros.map((macro) => <div className="macro-line" key={macro.name}><span className={`legend-dot ${macro.color}`} /><div><strong>{macro.name}</strong><small>Target {macro.target} g</small></div><b>{macro.grams} <small>g</small></b></div>)}
        </div>
      </div>
    </article>
  );
}
