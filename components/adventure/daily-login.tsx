"use client";
import Link from "next/link";
import { useAdventure } from "./adventure-state";
import { useDashboardState } from "@/components/dashboard/dashboard-state";

export function DailyLogin() {
  const { adventure, busy, act } = useAdventure();
  const { mode } = useDashboardState();
  if (!adventure) return null;
  const reward = adventure.dailyLogin;
  return <div className="daily-login">
    <div className="daily-login-copy">
      <h3>{reward.title} <span>+{reward.xp} XP</span></h3>
      <p>{mode === "demo" ? "Masuk dan ambil hadiah kecil untuk kunjunganmu hari ini." : reward.claimed ? "Sudah masuk hari ini. Hadiah berikutnya pukul 00.00 WIB." : "Senang kamu kembali. Hadiah hari ini sudah menunggu."}</p>
    </div>
    {mode === "demo" ? <Link className="ui-btn ui-btn-sm" href="/login">Masuk &amp; ambil</Link> : <button className="ui-btn ui-btn-sm" disabled={busy || reward.claimed} onClick={() => void act("claim", reward.id)}>{reward.claimed ? "Sudah diambil" : "Ambil hadiah login"}</button>}
  </div>;
}
