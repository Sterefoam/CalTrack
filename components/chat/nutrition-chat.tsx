"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { demoNutritionReply } from "@/lib/demo/nutrition-chat";
import { formatNumber, sumNutrition } from "@/lib/demo/nutrition-data";
import { localDateString } from "@/lib/demo/local-date";
import { recipes } from "@/lib/demo/recipes";
import { RecipeCard } from "@/components/recipes/recipe-card";

const suggestions = ["Saran menu untuk sisa kaloriku", "Bagaimana asupan proteinku?", "Sudah cukup minum?"];

export function NutritionChat() {
  const { foodLogs, exerciseLogs, targets, waterMl, chatMessages, setChatMessages, mode } = useDashboardState();
  const [question, setQuestion] = useState("");
  const [today, setToday] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => setToday(localDateString()), []);
  useEffect(() => { if (chatMessages.length) endRef.current?.scrollIntoView({ block: "nearest" }); }, [chatMessages.length]);
  const totals = sumNutrition(foodLogs.filter((log) => !log.date || log.date === today).flatMap((log) => log.items));
  const remaining = targets.calories - totals.calories + exerciseLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);
  const menuIdeas = recipes.filter((recipe) => recipe.calories <= remaining).slice(0, 2);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatMessages.length >= 40) return;
    const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    const reply = demoNutritionReply(trimmed, { remainingCalories: remaining, proteinG: totals.proteinG, proteinTarget: targets.proteinG, waterMl, waterTarget: targets.waterMl });
    setChatMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "user", text: trimmed, time }, { id: crypto.randomUUID(), role: "assistant", text: reply, time }]);
    setQuestion("");
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); send(question); }

  return <div className="content-wrap logging-page chat-page">
    <header className="page-heading"><h1>Asisten nutrisi</h1><p>Obrolkan menu dan kebiasaan makan dengan ringkasan harianmu.</p></header>
    <p className="demo-note">Simulasi percakapan. Balasan memakai {mode === "account" ? "ringkasan akun" : "data demo"} dan aturan sederhana, belum terhubung ke AI. Percakapan hanya tersimpan selama sesi ini.</p>
    <section className="chat-daily" aria-label="Konteks harian"><span>Sisa kalori <strong>{formatNumber(remaining)} kkal</strong></span><span>Protein <strong>{formatNumber(totals.proteinG)} / {formatNumber(targets.proteinG)} g</strong></span><span>Air minum <strong>{formatNumber(waterMl)} / {formatNumber(targets.waterMl)} ml</strong></span></section>
    <section className="surface-panel chat-panel" aria-labelledby="chat-title">
      <div className="section-title-row"><h2 id="chat-title">Percakapan hari ini</h2><button className="ui-btn ui-btn-ghost" disabled={!chatMessages.length} onClick={() => { setChatMessages([]); setQuestion(""); }}>Percakapan baru</button></div>
      <div className="chat-log" role="log" aria-label="Riwayat percakapan" aria-live="polite">
        <div className="ui-chat ui-chat-start"><div className="ui-chat-header">Asisten demo</div><div className="ui-chat-bubble">Halo! Mau mencari ide menu, melihat asupan protein, atau mengecek air minum? Pilih pertanyaan contoh atau tulis pertanyaanmu.</div></div>
        {chatMessages.map((message) => <div className={`ui-chat ${message.role === "user" ? "ui-chat-end" : "ui-chat-start"}`} key={message.id}><div className="ui-chat-header">{message.role === "user" ? "Kamu" : "Asisten demo"} <time>{message.time}</time></div><div className={`ui-chat-bubble${message.role === "user" ? " ui-chat-bubble-primary" : ""}`}>{message.text}</div></div>)}<div ref={endRef} />
      </div>
      <div className="chat-suggestions" aria-label="Pertanyaan contoh">{suggestions.map((suggestion) => <button className="ui-btn" key={suggestion} onClick={() => send(suggestion)} disabled={chatMessages.length >= 40}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={submit}><label className="field-label" htmlFor="chat-question">Pesanmu<textarea className="ui-textarea w-full" id="chat-question" maxLength={500} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Apa yang ingin kamu tanyakan?" required disabled={chatMessages.length >= 40} aria-describedby="chat-help" /></label><div className="chat-compose-actions"><p id="chat-help">{chatMessages.length >= 40 ? "Batas 20 pertanyaan tercapai. Mulai percakapan baru." : `${question.length}/500 karakter · Enter untuk baris baru`}</p><button className="ui-btn ui-btn-primary" type="submit" disabled={!question.trim() || chatMessages.length >= 40}>Kirim pesan</button></div></form>
    </section>
    <section className="mt-6" aria-labelledby="menu-ideas-title"><div className="section-title-row"><h2 id="menu-ideas-title">Ide menu contoh</h2><Link className="ui-btn ui-btn-ghost" href="/recipes">Semua resep</Link></div><p className="photo-description mb-4">Pilihan berdasarkan sisa kalori pada ringkasan harian, belum mempertimbangkan alergi atau kebutuhan khusus.</p>{menuIdeas.length ? <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">{menuIdeas.map((recipe) => <li key={recipe.id}><RecipeCard recipe={recipe} /></li>)}</ul> : <p className="surface-panel">Tidak ada resep contoh yang muat dalam sisa kalori saat ini. Lihat koleksi resep untuk meninjau porsinya.</p>}</section>
    <p className="chat-footnote">Saran bersifat umum. Kebutuhan gizi khusus sebaiknya dibahas dengan tenaga kesehatan. <Link href="/log/search">Buka katalog makanan</Link></p>
  </div>;
}
