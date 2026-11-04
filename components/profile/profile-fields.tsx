import { activityLevels, goals, type DemoProfile } from "@/lib/demo/profile";

export type ProfileFieldProps = { draft: DemoProfile; update: <K extends keyof DemoProfile>(key: K, value: DemoProfile[K]) => void };

export function PhysicalFields({draft, update}: ProfileFieldProps) { return <>
        <label className="field-label" htmlFor="profile-name">Nama<input id="profile-name" className="ui-input w-full" autoComplete="name" required maxLength={80} value={draft.name} onChange={(e) => update("name", e.target.value)} /></label>
        <div className="field-grid">
          <label className="field-label" htmlFor="profile-age">Usia (tahun)<input id="profile-age" className="ui-input w-full" type="number" min={18} max={100} step={1} required value={draft.age || ""} onChange={(e) => update("age", Number(e.target.value))} /></label>
          <label className="field-label" htmlFor="profile-gender">Jenis kelamin<select id="profile-gender" className="ui-select w-full" value={draft.gender} onChange={(e) => update("gender", e.target.value as DemoProfile["gender"])}><option value="male">Laki-laki</option><option value="female">Perempuan</option></select></label>
          <label className="field-label" htmlFor="profile-weight">Berat (kg)<input id="profile-weight" className="ui-input w-full" type="number" min={30} max={300} step={0.1} required value={draft.weightKg || ""} onChange={(e) => update("weightKg", Number(e.target.value))} /></label>
          <label className="field-label" htmlFor="profile-height">Tinggi (cm)<input id="profile-height" className="ui-input w-full" type="number" min={120} max={230} step={0.1} required value={draft.heightCm || ""} onChange={(e) => update("heightCm", Number(e.target.value))} /></label>
        </div>
</>; }

export function GoalFields({draft, update}: ProfileFieldProps) { return <>
        <label className="field-label" htmlFor="profile-activity">Aktivitas sehari-hari<select id="profile-activity" className="ui-select w-full" value={draft.activityLevel} onChange={(e) => update("activityLevel", e.target.value as DemoProfile["activityLevel"])}>{Object.entries(activityLevels).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
        <fieldset className="ui-fieldset"><legend className="ui-fieldset-legend text-sm">Tujuanmu</legend>{Object.entries(goals).map(([key, label]) => <label className="goal-option" key={key}><input className="ui-radio" type="radio" name="profile-goal" value={key} checked={draft.goal === key} onChange={() => update("goal", key as DemoProfile["goal"])} />{label}</label>)}</fieldset>
</>; }
