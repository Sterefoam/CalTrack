"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { adventureView, type Adventure } from "@/lib/adventure/quests";
import { api, jsonRequest } from "@/lib/client/api";

const Context = createContext<{ adventure: Adventure | null; busy: boolean; error: string; notice: string; refresh: () => void; act: (action: "claim" | "equip", id: string) => Promise<void> } | null>(null);
const questDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function AdventureProvider({ children }: { children: ReactNode }) {
  const { mode, foodLogs } = useDashboardState();
  const [adventure, setAdventure] = useState<Adventure | null>(null);
  const [day, setDay] = useState("");
  const [claims, setClaims] = useState<string[]>([]);
  const [demoXp, setDemoXp] = useState(0);
  const [equipped, setEquipped] = useState("moon-scout");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  useEffect(() => { setDay(questDay()); const timer = window.setInterval(() => setDay(questDay()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { setClaims([]); }, [day]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (mode !== "account") return;
    try { const value = await api<Adventure>("/api/adventure", { signal }); if (!signal?.aborted) { setAdventure(value); setError(""); } }
    catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Progres belum dimuat."); }
  }, [mode]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh, foodLogs, day]);
  const logs = foodLogs.filter(log => !log.date || log.date === day);
  const demo = adventureView(day, { meals: logs.length, types: new Set(logs.map(log => log.mealType)).size, foods: new Set(logs.flatMap(log => log.items.map(item => item.foodName.trim().toLocaleLowerCase("id")))).size }, claims, demoXp, equipped);
  const value = mode === "demo" ? demo : adventure;
  async function act(action: "claim" | "equip", id: string) {
    if (lock.current || !value) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "account") setAdventure(await api<Adventure>("/api/adventure", jsonRequest("POST", { action, ...(action === "claim" ? { questId: id } : { rewardId: id }) })));
      else if (action === "claim") {
        const quest = value.quests.find(item => item.id === id);
        if (!quest?.ready || quest.claimed) return;
        setClaims(current => [...current, id]); setDemoXp(current => current + quest.xp);
      } else { if (!value.rewards.find(item => item.id === id)?.unlocked) return; setEquipped(id); }
      setNotice(action === "claim" ? "Quest selesai. XP ditambahkan ke perjalananmu!" : "Hadiah dipakai pada penjelajahmu.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Hadiah belum berhasil disimpan."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Context.Provider value={{ adventure: value, busy, error, notice, refresh: () => void refresh(), act }}>{children}</Context.Provider>;
}
export function useAdventure() { const context = useContext(Context); if (!context) throw new Error("AdventureProvider required"); return context; }
