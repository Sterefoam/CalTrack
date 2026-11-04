"use client";

import { useEffect, useState } from "react";
import { CalorieCard } from "@/components/dashboard/calorie-card";
import { MacroChart } from "@/components/dashboard/macro-chart";
import { WaterTracker } from "@/components/dashboard/water-tracker";
import { MealHistory, type MealSession } from "@/components/dashboard/meal-history";
import { ExerciseForm } from "@/components/dashboard/exercise-form";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/layout/icon";
import { useDashboardState } from "@/components/dashboard/dashboard-state";

import { mealLabels, sumNutrition, formatNumber } from "@/lib/demo/nutrition-data";
import { Dialog } from "@/components/layout/dialog";
import { localDateString } from "@/lib/demo/local-date";

export default function DashboardPage() {
  const router = useRouter();
  const { waterMl, setWaterMl, exerciseLogs, setExerciseLogs, foodLogs, targets, profile, savedNotice, setSavedNotice } = useDashboardState();
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const dailyLogs = foodLogs.filter((log) => !log.date || log.date === todayKey);
  const totals = sumNutrition(dailyLogs.flatMap((log) => log.items));
  const mealSessions: MealSession[] = dailyLogs.map((log) => ({ id: log.id, label: mealLabels[log.mealType], time: log.time, items: log.items.map((item, index) => ({ id: `${log.id}:${index}`, title: item.foodName, detail: `${formatNumber(item.weightGrams)} g`, calories: item.calories, emoji: "", color: "sand" })) }));
  const selectedFood = dailyLogs.flatMap((log) => log.items.map((item, index) => ({ id: `${log.id}:${index}`, item }))).find((entry) => entry.id === detail)?.item;
  const [toast, setToast] = useState("");
  const totalExerciseCalories = exerciseLogs.reduce((total, log) => total + log.caloriesBurned, 0);
  const totalExerciseMinutes = exerciseLogs.reduce((total, log) => total + log.durationMinutes, 0);
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()));
    setTodayKey(localDateString());
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  return (
    <>
        <div className="content-wrap">
          {savedNotice && <div className="ui-alert ui-alert-success mb-6" role="status"><span>{savedNotice}</span><button className="ui-btn ui-btn-ghost" aria-label="Tutup pemberitahuan" onClick={() => setSavedNotice("")}><Icon name="close" size={18} /></button></div>}
          <div className="welcome-row">
            <div>
              
              <h1>Hari ini, {profile.name.split(" ")[0]}</h1>
              <p className="welcome-subtitle">{today} &middot; Data contoh</p>
            </div>
            <Link className="ui-btn ui-btn-primary" href="/log" aria-label="Catat makanan"><Icon name="plus" size={19} /> Catat makanan</Link>
          </div>

          <section className="hero-grid" aria-label="Ringkasan kalori dan target">
            <CalorieCard targetCalories={targets.calories} consumedCalories={totals.calories} exerciseCalories={totalExerciseCalories} onInfo={() => notify("Sisa kalori = target − makanan + olahraga")} />

            <MacroChart proteinGrams={totals.proteinG} proteinTarget={targets.proteinG} carbsGrams={totals.carbsG} carbsTarget={targets.carbsG} fatGrams={totals.fatG} fatTarget={targets.fatG} onDetails={() => setDetail("nutrisi")} />
          </section>

          <section className="lower-grid">
            <MealHistory sessions={mealSessions} onAdd={() => router.push("/log")} onViewAll={() => router.push("/history")} onMealClick={setDetail} />

            <div className="side-widgets">
              <WaterTracker amountMl={waterMl} targetMl={targets.waterMl} onAdd={(amount) => setWaterMl((value) => Math.min(value + amount, 20000))} onRemove={(amount) => setWaterMl((value) => Math.max(0, value - amount))} onReset={() => setWaterMl(0)} />
              <article className="exercise-card">
                <div className="exercise-icon"><Icon name="fire" size={21}/></div>
                <div className="exercise-content"><div className="card-kicker">Aktivitas hari ini</div><strong>{exerciseLogs.length === 1 ? exerciseLogs[0].activity : `${exerciseLogs.length} aktivitas`}</strong><span><b>{totalExerciseCalories}</b> kkal terbakar <i>·</i> {totalExerciseMinutes} menit</span></div>
                <button className="exercise-add" aria-label="Tambah olahraga" onClick={() => setShowExerciseModal(true)}><Icon name="plus" size={18}/></button>
              </article>
            </div>
          </section>


        </div>
      {showExerciseModal && <ExerciseForm onClose={() => setShowExerciseModal(false)} onSave={(log) => { setExerciseLogs((current) => [...current, log]); setShowExerciseModal(false); notify(`${log.activity} berhasil dicatat`); }} />}
      {detail && <Dialog title={detail === "nutrisi" ? "Asupan gizi hari ini" : detail === "riwayat" ? "Catatan hari ini" : selectedFood?.foodName ?? "Detail makanan"} onClose={() => setDetail(null)}>
        {detail === "riwayat" ? <div className="mt-4 space-y-4">{dailyLogs.map((log) => <div key={log.id}><strong>{mealLabels[log.mealType]} &middot; {log.time}</strong>{log.items.map((item) => <p key={item.foodName}>{item.foodName} &middot; {formatNumber(item.calories)} kkal</p>)}</div>)}</div> : (() => {
          const data = detail === "nutrisi" ? totals : selectedFood;
          return data && <dl className="nutrition-facts">{[["Kalori", data.calories, "kkal"], ["Protein", data.proteinG, "g"], ["Karbohidrat", data.carbsG, "g"], ["Lemak", data.fatG, "g"], ["Serat", data.fiberG, "g"], ["Gula", data.sugarG, "g"], ["Natrium", data.sodiumMg, "mg"]].map(([label,value,unit]) => <div key={label}><dt>{label}</dt><dd>{formatNumber(Number(value))} {unit}</dd></div>)}</dl>;
        })()}
      </Dialog>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
