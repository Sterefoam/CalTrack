import { calculateTargets, type PhysicalProfile } from "@/lib/nutrition/profile";
export { activityLevels, goals } from "@/lib/nutrition/profile";
export type DemoProfile = PhysicalProfile;
export const initialProfile: DemoProfile = { name: "Aditya Nugraha", age: 28, gender: "male", weightKg: 75, heightCm: 175, activityLevel: "light", goal: "maintenance" };
export function previewTargets(profile: DemoProfile) {
  const { calories, proteinG, fatG, carbsG, waterMl } = calculateTargets(profile);
  return { calories, proteinG, fatG, carbsG, waterMl };
}
