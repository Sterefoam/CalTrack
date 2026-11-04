export const activityLevels = {
  sedentary: { label: "Jarang bergerak", factor: 1.2 },
  light: { label: "Ringan, olahraga 1-3 kali/minggu", factor: 1.375 },
  moderate: { label: "Sedang, olahraga 3-5 kali/minggu", factor: 1.55 },
  active: { label: "Aktif, olahraga 6-7 kali/minggu", factor: 1.725 },
  very_active: { label: "Sangat aktif, kerja fisik berat", factor: 1.9 }
};
export const goals = { weight_loss: "Turun berat badan", maintenance: "Jaga berat badan", weight_gain: "Naik berat badan" };
export type PhysicalProfile = { name: string; age: number; gender: "male" | "female"; weightKg: number; heightCm: number; activityLevel: keyof typeof activityLevels; goal: keyof typeof goals };
export function calculateTargets(profile: PhysicalProfile) {
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.gender === "male" ? 5 : -161);
  const tdee = bmr * activityLevels[profile.activityLevel].factor;
  const calories = Math.round(tdee * (profile.goal === "weight_loss" ? 0.85 : profile.goal === "weight_gain" ? 1.1 : 1));
  const proteinG = Math.round(profile.weightKg * 1.6);
  const fatG = Math.round(calories * 0.25 / 9);
  return { bmr, tdee, calories, proteinG, fatG, carbsG: Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4)), waterMl: 2500 };
}
export function validateProfile(value: unknown): PhysicalProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  const range = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (typeof p.name !== "string" || !p.name.trim() || p.name.trim().length > 80 || !range(p.age, 18, 100) || !Number.isInteger(p.age) || !range(p.weightKg, 30, 300) || !range(p.heightCm, 120, 230)) return null;
  if (p.gender !== "male" && p.gender !== "female") return null;
  if (typeof p.activityLevel !== "string" || !Object.hasOwn(activityLevels, p.activityLevel) || typeof p.goal !== "string" || !Object.hasOwn(goals, p.goal)) return null;
  return { name: p.name.trim(), age: p.age, gender: p.gender, weightKg: p.weightKg, heightCm: p.heightCm, activityLevel: p.activityLevel as PhysicalProfile["activityLevel"], goal: p.goal as PhysicalProfile["goal"] };
}
