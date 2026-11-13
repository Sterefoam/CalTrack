import { calculateRemainingCalories } from "@/lib/nutrition/calorie-balance";

type CalorieCardProps = {
  targetCalories: number;
  consumedCalories: number;
  exerciseCalories: number;
  onInfo?: () => void;
};

const formatCalories = (calories: number) => new Intl.NumberFormat("id-ID").format(calories);

export function CalorieCard({ targetCalories, consumedCalories, exerciseCalories, onInfo }: CalorieCardProps) {
  const remainingCalories = calculateRemainingCalories({ targetCalories, consumedCalories, exerciseCalories });
  const consumedPercent = targetCalories > 0 ? Math.round((consumedCalories / targetCalories) * 100) : 0;

  return (
    <article className="calorie-card">
      <div className="card-topline">
        <div>
          <h2 className="card-heading">Energi hari ini</h2>
          <div className="card-kicker">Sisa dari target harian</div>
        </div>
        <button className="icon-button light" aria-label="Info kalori" onClick={onInfo}><span>i</span></button>
      </div>
      <div className="calorie-main">
        <div className="calorie-number" aria-live="polite"><strong>{formatCalories(Math.abs(remainingCalories))}</strong><span>{remainingCalories < 0 ? "kkal melewati target" : "kkal tersisa"}</span></div>
        <div className="calorie-ring" role="img" aria-label={`Sudah mengonsumsi ${formatCalories(consumedCalories)} dari ${formatCalories(targetCalories)} kilokalori`}>
          <svg className="ring-chart" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-base-300)" strokeWidth="4" /><circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-accent)" strokeWidth="4" pathLength="100" strokeDasharray={`${Math.min(100, consumedPercent)} 100`} transform="rotate(-90 50 50)" /></svg><div className="ring-inner"><span>{consumedPercent}%</span><small>terpakai</small></div>
        </div>
      </div>
      <div className="calorie-equation">
        <div><span>Target</span><strong>{formatCalories(targetCalories)}</strong></div><b>−</b><div><span>Makanan</span><strong>{formatCalories(consumedCalories)}</strong></div><b>+</b><div><span>Olahraga</span><strong>{formatCalories(exerciseCalories)}</strong></div>
      </div>
      <div className="calorie-footnote">{remainingCalories >= 0 ? "Target - makanan + olahraga" : "Asupan melewati target hari ini"}</div>
      
    </article>
  );
}
