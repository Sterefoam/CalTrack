import { demoFoodLogs } from "@/lib/demo/nutrition-data";
import { initialProfile, previewTargets } from "@/lib/demo/profile";

// Local async API stub: every request gets independent example data.
export async function loadDemoDashboard() {
  return structuredClone({
    profile: initialProfile,
    targets: previewTargets(initialProfile),
    logs: demoFoodLogs,
    water: { amountMl: 1250 },
    exercise: { entries: [{ activity: "Jalan cepat", durationMinutes: 35, caloriesBurned: 165 }] }
  });
}
