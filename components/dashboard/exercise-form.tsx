"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/layout/dialog";

export type ExerciseLog = { activity: string; durationMinutes: number; caloriesBurned: number };
type ExerciseFormProps = { onClose: () => void; onSave: (log: ExerciseLog) => void };

export function ExerciseForm({ onClose, onSave }: ExerciseFormProps) {
  const [activity, setActivity] = useState("Jalan cepat");
  const [duration, setDuration] = useState(30);
  const [calories, setCalories] = useState(140);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ activity, durationMinutes: duration, caloriesBurned: calories });
  }
  return <Dialog title="Catat olahraga" onClose={onClose}>
    <p className="photo-description mt-4">Tambahkan aktivitas untuk memperbarui sisa kalori hari ini.</p>
    <form className="form-stack mt-5" onSubmit={submit}>
      <label className="field-label" htmlFor="exercise-activity">Jenis aktivitas<select id="exercise-activity" className="ui-select w-full" value={activity} onChange={(e) => setActivity(e.target.value)}><option>Jalan cepat</option><option>Lari</option><option>Bersepeda</option><option>Latihan beban</option><option>Renang</option><option>Aktivitas lain</option></select></label>
      <div className="field-grid"><label className="field-label" htmlFor="exercise-duration">Durasi (menit)<input id="exercise-duration" className="ui-input w-full" type="number" min={1} max={1440} step={1} required value={duration || ""} onChange={(e) => setDuration(Number(e.target.value))} /></label><label className="field-label" htmlFor="exercise-calories">Kalori terbakar (kkal)<input id="exercise-calories" className="ui-input w-full" type="number" min={0} max={20000} step={1} required value={calories} onChange={(e) => setCalories(Number(e.target.value))} /></label></div>
      <p className="photo-description">Kalori adalah estimasi. Sesuaikan dengan catatan aktivitas yang kamu punya.</p>
      <div className="onboarding-actions"><button type="button" className="ui-btn" onClick={onClose}>Batal</button><button type="submit" className="ui-btn ui-btn-primary">Simpan aktivitas</button></div>
    </form>
  </Dialog>;
}
