import { formatNumber } from "@/lib/demo/nutrition-data";
type MacroChartProps = { proteinGrams: number; proteinTarget: number; carbsGrams: number; carbsTarget: number; fatGrams: number; fatTarget: number; onDetails?: () => void };
export function MacroChart(props: MacroChartProps) {
  const macros = [{ name: "Protein", value: props.proteinGrams, target: props.proteinTarget }, { name: "Karbohidrat", value: props.carbsGrams, target: props.carbsTarget }, { name: "Lemak", value: props.fatGrams, target: props.fatTarget }];
  return <article className="macro-card panel-card"><div className="section-title-row"><h2>Asupan harian</h2><button className="text-button" onClick={props.onDetails}>Detail gizi ↗</button></div><div className="macro-bars">{macros.map(macro => <div className="macro-bar" key={macro.name}><div><span>{macro.name}</span><strong>{formatNumber(macro.value)} <small>/ {formatNumber(macro.target)} g</small></strong></div><progress className="ui-progress" value={Math.min(macro.value, macro.target)} max={macro.target || 1} aria-label={`${macro.name}: ${formatNumber(macro.value)} dari target ${formatNumber(macro.target)} gram`} /></div>)}</div></article>;
}
