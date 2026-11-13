"use client";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { createFoodDraft } from "@/lib/logging/food-draft";
export function ManualLogButton() {
  const { setFoodDraft } = useDashboardState();
  const router = useRouter();
  return <button type="button" className="ui-btn" onClick={() => {
    setFoodDraft({ ...createFoodDraft("text", [{ foodName: "", weightGrams: 100, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 }]), origin: "manual" });
    router.push("/log/review");
  }}>Isi gizi manual</button>;
}
