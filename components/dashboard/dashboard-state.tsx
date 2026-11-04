"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { ExerciseLog } from "./exercise-form";
import { demoFoodLogs, demoTargets, type DemoFoodLog } from "@/lib/demo/nutrition-data";
import { initialProfile, previewTargets, type DemoProfile } from "@/lib/demo/profile";
import type { FoodDraft } from "@/lib/logging/food-draft";
import type { ChatMessage } from "@/lib/demo/nutrition-chat";
import { localDateString } from "@/lib/demo/local-date";
import { sameFoodItems, type FavoriteFood } from "@/lib/logging/favorite-food";

type DashboardState = {
  waterMl: number;
  setWaterMl: Dispatch<SetStateAction<number>>;
  exerciseLogs: ExerciseLog[];
  setExerciseLogs: Dispatch<SetStateAction<ExerciseLog[]>>;
  foodLogs: DemoFoodLog[];
  saveFoodLog: (draft: FoodDraft) => void;
  savedNotice: string;
  setSavedNotice: Dispatch<SetStateAction<string>>;
  profile: DemoProfile;
  targets: typeof demoTargets;
  saveProfile: (profile: DemoProfile) => void;
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
};

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [waterMl, setWaterMl] = useState(1250);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [foodDraft, setFoodDraft] = useState<FoodDraft | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [textDraft, setTextDraft] = useState("");
  const [voiceRecording, setVoiceRecording] = useState<Blob | null>(null);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const addFavorite = (favorite: Omit<FavoriteFood, "id">) => {
    const entry = { ...favorite, id: crypto.randomUUID(), items: structuredClone(favorite.items) };
    setFavorites((current) => current.some((item) => sameFoodItems(item.items, entry.items)) ? current : [...current, entry]);
  };
  const removeFavorite = (id: string) => setFavorites((current) => current.filter((item) => item.id !== id));
  const [foodLogs, setFoodLogs] = useState(demoFoodLogs);
  const [savedNotice, setSavedNotice] = useState("");
  const saveFoodLog = (draft: FoodDraft) => {
    const now = new Date();
    const log: DemoFoodLog = { id: draft.id, mealType: draft.mealType, time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, date: localDateString(now), items: structuredClone(draft.items) };
    setFoodLogs((logs) => logs.some((item) => item.id === log.id) ? logs : [...logs, log]);
    setFoodDraft(null);
    setSavedNotice("Catatan makanan ditambahkan. Data demo tersimpan selama sesi ini.");
  };
  const [profile, setProfile] = useState(initialProfile);
  const [targets, setTargets] = useState(demoTargets);
  const saveProfile = (value: DemoProfile) => { setProfile(value); setTargets(previewTargets(value)); };
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([
    { activity: "Jalan cepat", durationMinutes: 35, caloriesBurned: 165 },
  ]);
  return <DashboardContext.Provider value={{ waterMl, setWaterMl, exerciseLogs, setExerciseLogs, foodLogs, saveFoodLog, savedNotice, setSavedNotice, profile, targets, saveProfile, photoFile, setPhotoFile, foodDraft, setFoodDraft, chatMessages, setChatMessages, textDraft, setTextDraft, voiceRecording, setVoiceRecording, favorites, addFavorite, removeFavorite }}>{children}</DashboardContext.Provider>;
}

export function useDashboardState() {
  const state = useContext(DashboardContext);
  if (!state) throw new Error("DashboardProvider diperlukan");
  return state;
}
