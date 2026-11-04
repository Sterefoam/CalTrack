export type MealItem = {
  id: string;
  title: string;
  detail: string;
  calories: number;
  emoji: string;
  color: "sand" | "peach" | "lavender";
};

export type MealSession = {
  id: string;
  label: string;
  time: string;
  items: MealItem[];
};

type MealHistoryProps = {
  sessions: MealSession[];
  onAdd: () => void;
  onViewAll: () => void;
  onMealClick: (id: string) => void;
};

const formatCalories = (calories: number) => new Intl.NumberFormat("id-ID").format(calories);

export function MealHistory({ sessions, onAdd, onViewAll, onMealClick }: MealHistoryProps) {
  const mealCount = sessions.reduce((total, session) => total + session.items.length, 0);
  const calorieCount = sessions.reduce((total, session) => total + session.items.reduce((sessionTotal, item) => sessionTotal + item.calories, 0), 0);

  return (
    <article className="panel-card meal-card">
      <div className="section-title-row meal-heading"><div><div className="card-kicker">Yang sudah kamu catat</div><h2>Riwayat makan <span className="today-chip">Hari ini</span></h2></div><button className="text-button" onClick={onViewAll}>Lihat semua <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button></div>
      <div className="meal-summary"><span><strong>{mealCount}</strong> makanan</span><span className="summary-separator"/><span><strong>{formatCalories(calorieCount)}</strong> kkal total</span></div>
      <div className="meal-list">
        {sessions.map((session) => <section className="meal-session" key={session.id} aria-label={`${session.label}, ${session.time}`}>
          <div className="meal-session-heading"><strong>{session.label}</strong><time>{session.time}</time></div>
          {session.items.map((meal) => <div className="meal-row" key={meal.id}>
            
            <div className="meal-info"><strong>{meal.title}</strong><small>{meal.detail}</small></div>
            <div className="meal-calories"><strong>{formatCalories(meal.calories)}</strong><span>kkal</span></div>
            <button className="row-more" aria-label={`Detail ${meal.title}`} onClick={() => onMealClick(meal.id)}>···</button>
          </div>)}
        </section>)}
      </div>
      <button className="add-meal-link" onClick={onAdd}><span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></span> Tambah catatan makan</button>
    </article>
  );
}
