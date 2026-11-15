"use client";

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { ExerciseLog } from "./exercise-form";
import { demoFoodLogs, demoTargets, type DemoFoodLog } from "@/lib/demo/nutrition-data";
import { initialProfile, previewTargets, type DemoProfile } from "@/lib/demo/profile";
import type { FoodDraft } from "@/lib/logging/food-draft";
import type { ChatMessage } from "@/lib/demo/nutrition-chat";
import { localDateString } from "@/lib/demo/local-date";
import { sameFoodItems, type FavoriteFood } from "@/lib/logging/favorite-food";
import { api, jsonRequest, loadFoodHistory, browserTimeZone, toClientLog, type FoodLogResponse } from "@/lib/client/api";
import { initialReminders, type ReminderSettings } from "@/lib/demo/reminders";
import { loadDemoDashboard } from "@/lib/client/demo-dashboard";

type DashboardState = {
  reminders: ReminderSettings;
  setReminders: Dispatch<SetStateAction<ReminderSettings>>;
  waterMl: number;
  setWaterMl: Dispatch<SetStateAction<number>>;
  exerciseLogs: ExerciseLog[];
  setExerciseLogs: Dispatch<SetStateAction<ExerciseLog[]>>;
  foodLogs: DemoFoodLog[];
  saveFoodLog: (draft: FoodDraft) => Promise<void>;
  mode: "demo" | "account";
  hasProfile: boolean;
  savedNotice: string;
  setSavedNotice: Dispatch<SetStateAction<string>>;
  profile: DemoProfile;
  targets: typeof demoTargets;
  saveProfile: (profile: DemoProfile) => Promise<void>;
  photoFile: File | null;
  setPhotoFile: Dispatch<SetStateAction<File | null>>;
  foodDraft: FoodDraft | null;
  setFoodDraft: Dispatch<SetStateAction<FoodDraft | null>>;
  chatMessages: ChatMessage[];
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  textDraft: string;
  setTextDraft: Dispatch<SetStateAction<string>>;
  voiceRecording: Blob | null;
  setVoiceRecording: Dispatch<SetStateAction<Blob | null>>;
  favorites: FavoriteFood[];
  addFavorite: (favorite: Omit<FavoriteFood, "id">) => void;
  removeFavorite: (id: string) => void;
  favoriteRecipeIds: string[];
  setFavoriteRecipeIds: Dispatch<SetStateAction<string[]>>;
};

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [reminders, setReminders] = useState(initialReminders);
  const [connection, setConnection] = useState<"loading" | "demo" | "account" | "error">("loading");
  const [connectionError, setConnectionError] = useState("");
  const [hasProfile, setHasProfile] = useState(true);
  const [waterMl, setWaterMl] = useState(1250);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [foodDraft, setFoodDraft] = useState<FoodDraft | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [textDraft, setTextDraft] = useState("");
  const [voiceRecording, setVoiceRecording] = useState<Blob | null>(null);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<string[]>([]);
  const addFavorite = (favorite: Omit<FavoriteFood, "id">) => {
    const entry = { ...favorite, id: crypto.randomUUID(), items: structuredClone(favorite.items) };
    setFavorites((current) => current.some((item) => sameFoodItems(item.items, entry.items)) ? current : [...current, entry]);
  };
  const removeFavorite = (id: string) => setFavorites((current) => current.filter((item) => item.id !== id));
  const [foodLogs, setFoodLogs] = useState(demoFoodLogs);
  const [savedNotice, setSavedNotice] = useState("");
  const saveFoodLog = async (draft: FoodDraft) => {
    if (connection === "account") {
      const result = await api<FoodLogResponse>("/api/food-logs", jsonRequest("POST", { mealType: draft.mealType, inputMethod: draft.origin === "recipe" ? "recipe" : draft.inputMethod, confidenceScore: draft.confidenceScore, notes: draft.notes, items: draft.items }));
      setFoodLogs((logs) => [...logs, toClientLog(result)]);
      setFoodDraft(null);
      setSavedNotice("Catatan makanan tersimpan di akunmu.");
      return;
    }
    if (connection !== "demo") throw new Error("Tunggu pemeriksaan koneksi sebelum menyimpan.");
    const now = new Date();
    const log: DemoFoodLog = { id: draft.id, mealType: draft.mealType, time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, date: localDateString(now), inputMethod: draft.origin === "recipe" ? "recipe" : draft.inputMethod, notes: draft.notes, items: structuredClone(draft.items) };
    setFoodLogs((logs) => logs.some((item) => item.id === log.id) ? logs : [...logs, log]);
    setFoodDraft(null);
    setSavedNotice("Catatan makanan ditambahkan. Data demo tersimpan selama sesi ini.");
  };
  const [profile, setProfile] = useState(initialProfile);
  const [targets, setTargets] = useState(() => previewTargets(initialProfile));
  const saveProfile = async (value: DemoProfile) => {
    if (connection === "account") {
      const result = await api<{ profile: DemoProfile; targets: typeof demoTargets }>("/api/profile", jsonRequest("PUT", value));
      setProfile(result.profile); setTargets(result.targets); setHasProfile(true);
    } else if (connection === "demo") { setProfile(value); setTargets(previewTargets(value)); }
    else throw new Error("Koneksi akun belum siap.");
  };
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([
    { activity: "Jalan cepat", durationMinutes: 35, caloriesBurned: 165 },
  ]);
  async function initializeDemo(signal?: AbortSignal) {
    const data = await loadDemoDashboard();
    if (signal?.aborted) return;
    setProfile(data.profile); setTargets(data.targets); setHasProfile(true);
    setFoodLogs(data.logs); setWaterMl(data.water.amountMl); setExerciseLogs(data.exercise.entries);
    setConnection("demo");
  }
  async function initialize(signal?: AbortSignal) {
    setConnection("loading");
    try {
      const session = await api<{ user: { id: string; name: string } } | null>("/api/auth/get-session", { signal });
      if (!session?.user) {
        let demoRequested = new URLSearchParams(window.location.search).get("demo") === "1";
        try {
          demoRequested ||= window.sessionStorage.getItem("caltrack-demo") === "1";
          if (demoRequested) window.sessionStorage.setItem("caltrack-demo", "1");
        } catch { /* Explicit demo links still work when browser storage is unavailable. */ }
        if (signal?.aborted) return;
        if (!demoRequested) { window.location.replace("/login"); return; }
        await initializeDemo(signal); return;
      }
      try { window.sessionStorage.removeItem("caltrack-demo"); } catch { /* Account access does not depend on browser storage. */ }
      const date = localDateString();
      const [stored, logs, daily] = await Promise.all([
        api<{ profile: DemoProfile } | null>("/api/profile", { signal }),
        loadFoodHistory(date, signal),
        api<{ water: { amountMl: number }; exercise: { entries: ExerciseLog[] } }>(`/api/dashboard/daily?${new URLSearchParams({ date, timeZone: browserTimeZone() })}`, { signal }),
      ]);
      if (signal?.aborted) return;
      setProfile(stored?.profile ?? { ...initialProfile, name: session.user.name });
      setHasProfile(!!stored);
      setTargets(stored ? previewTargets(stored.profile) : { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, waterMl: 2500 });
      setFoodLogs(logs); setExerciseLogs(daily.exercise.entries); setWaterMl(daily.water.amountMl);
      setConnection("account");
    } catch (error) { if (!signal?.aborted) { setConnectionError(error instanceof Error ? error.message : "Koneksi akun belum tersedia."); setConnection("error"); } }
  }
  useEffect(() => { const controller = new AbortController(); void initialize(controller.signal); return () => controller.abort(); }, []);
  if (connection === "loading") return <main className="content-wrap"><p role="status">Memuat sesi dan catatan makanan...</p></main>;
  if (connection === "error") return <main className="content-wrap"><section className="surface-panel form-stack"><h1>Koneksi akun belum tersedia</h1><p role="alert">{connectionError}</p><button className="ui-btn" onClick={() => void initialize()}>Coba lagi</button><button className="ui-btn ui-btn-ghost" onClick={() => void initializeDemo()}>Jelajahi mode demo</button><p>Mode demo memakai data contoh dan tidak menyimpan catatan ke akun.</p></section></main>;
  return <DashboardContext.Provider value={{ reminders, setReminders, mode: connection, hasProfile, waterMl, setWaterMl, exerciseLogs, setExerciseLogs, foodLogs, saveFoodLog, savedNotice, setSavedNotice, profile, targets, saveProfile, photoFile, setPhotoFile, foodDraft, setFoodDraft, chatMessages, setChatMessages, textDraft, setTextDraft, voiceRecording, setVoiceRecording, favorites, addFavorite, removeFavorite, favoriteRecipeIds, setFavoriteRecipeIds }}>{children}</DashboardContext.Provider>;
}

export function useDashboardState() {
  const state = useContext(DashboardContext);
  if (!state) throw new Error("DashboardProvider diperlukan");
  return state;
}
