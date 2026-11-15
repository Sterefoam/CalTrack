"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { adventureView, optionalQuestLimit, questMetrics, type Adventure } from "@/lib/adventure/quests";
import { achievementFor, type Achievement } from "@/lib/adventure/achievements";
import { AdventureFeedback } from "./adventure-feedback";
import { api, jsonRequest } from "@/lib/client/api";

const Context = createContext<{ adventure: Adventure | null; busy: boolean; error: string; notice: string; refresh: () => void; act: (action: "claim" | "equip" | "accept", id: string) => Promise<void> } | null>(null);
const questDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function AdventureProvider({ children }: { children: ReactNode }) {
  const { mode, foodLogs } = useDashboardState();
  const [adventure, setAdventure] = useState<Adventure | null>(null);
  const [day, setDay] = useState("");
  const [claims, setClaims] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [demoXp, setDemoXp] = useState(0);
  const [equipped, setEquipped] = useState("moon-scout");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [celebration, setCelebration] = useState<(Achievement & { id: number }) | null>(null);
  const lock = useRef(false);
  const revision = useRef(0);
  const refreshRequest = useRef<AbortController | null>(null);
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  useEffect(() => { setDay(questDay()); const timer = window.setInterval(() => setDay(questDay()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { setClaims([]); setAccepted([]); setNotice(""); }, [day]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (mode !== "account" || lock.current) return;
    refreshRequest.current?.abort();
    const controller = new AbortController(); refreshRequest.current = controller;
    const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const version = ++revision.current;
    try { const value = await api<Adventure>("/api/adventure", { signal: requestSignal }); if (!requestSignal.aborted && version === revision.current) { setAdventure(value); setError(""); } }
    catch (cause) { if (!requestSignal.aborted && version === revision.current) setError(cause instanceof Error ? cause.message : "Progres belum dimuat."); }
  }, [mode]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh, foodLogs, day]);
  const logs = foodLogs.filter(log => !log.date || log.date === day);
  const metrics = questMetrics(logs, logs.flatMap(log => log.items.map(item => item.foodName)));
  const demo = adventureView(day, metrics, claims, demoXp, equipped, accepted);
  const value = mode === "demo" ? demo : adventure;
  async function act(action: "claim" | "equip" | "accept", id: string) {
    if (lock.current || !value) return;
    lock.current = true; ++revision.current; refreshRequest.current?.abort(); setBusy(true); setError(""); setNotice("");
    try {
      let next: Adventure;
      if (mode === "account") { next = await api<Adventure>("/api/adventure", jsonRequest("POST", { action, ...(action === "equip" ? { rewardId: id } : { questId: id }) })); setAdventure(next); }
      else if (action === "claim") {
        if (id === value.dailyLogin.id) throw new Error("Masuk ke akun untuk mengambil hadiah login harian.");
        const quest = [...value.quests, ...value.optionalQuests].find(item => item.id === id);
        if (!quest?.ready || quest.claimed) return;
        setClaims(current => [...current, id]); setDemoXp(current => current + quest.xp);
        next = adventureView(day, metrics, [...claims, id], demoXp + quest.xp, equipped, accepted);
      } else if (action === "accept") {
        if (accepted.length >= optionalQuestLimit || !value.optionalQuests.some(quest => quest.id === id && !quest.accepted)) return;
        setAccepted(current => [...current, id]); next = adventureView(day, metrics, claims, demoXp, equipped, [...accepted, id]);
      } else { if (!value.rewards.find(item => item.id === id)?.unlocked) return; setEquipped(id); next = adventureView(day, metrics, claims, demoXp, id, accepted); }
      const event = achievementFor(value, next);
      if (event) setCelebration({ ...event, id: Date.now() });
      setNotice(action === "claim" ? (id === value.dailyLogin.id ? (event ? "Hadiah login diambil. Sampai jumpa besok!" : "Hadiah login hari ini sudah diambil.") : event ? "Quest selesai. XP ditambahkan ke perjalananmu!" : "XP quest ini sudah pernah diambil.") : action === "accept" ? "Quest pilihan diambil. Catatan hari ini juga dihitung." : "Hadiah dipakai pada penjelajahmu.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Hadiah belum berhasil disimpan."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Context.Provider value={{ adventure: value, busy, error, notice, refresh: () => void refresh(), act }}>{children}{celebration && <AdventureFeedback key={celebration.id} event={celebration} onClose={dismissCelebration} />}</Context.Provider>;
}
export function useAdventure() { const context = useContext(Context); if (!context) throw new Error("AdventureProvider required"); return context; }
