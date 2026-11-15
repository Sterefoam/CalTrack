"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { api, browserTimeZone, jsonRequest } from "@/lib/client/api";
import { Icon } from "@/components/layout/icon";

type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
type Conversation = { id: string; title: string };
type Status = { ready: boolean; provider: string; model: string };
const suggestions = ["Ide makan malam yang praktis?", "Bagaimana asupan proteinku?", "Menu hemat dengan tahu dan tempe?"];

export function NutritionChat() {
  const { mode } = useDashboardState();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [status, setStatus] = useState<Status>();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const inFlight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async (id?: string, signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const result = await api<{ conversations?: Conversation[]; messages?: Message[]; status: Status }>(`/api/chat${id ? `?conversationId=${encodeURIComponent(id)}` : ""}`, { signal });
      if (signal?.aborted) return;
      setStatus(result.status);
      if (result.conversations) setConversations(result.conversations);
      if (result.messages) { setMessages(result.messages); setConversationId(id); }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Percakapan belum dapat dimuat."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { if (mode !== "account") return; const controller = new AbortController(); void load(undefined, controller.signal); return () => controller.abort(); }, [mode, load]);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => { if (messages.length || busy) endRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [messages.length, busy]);
  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || inFlight.current || loading || messages.length >= 40 || mode !== "account") return;
    inFlight.current = true; setBusy(true); setError(""); setPendingQuestion(trimmed);
    const controller = new AbortController(); requestRef.current = controller;
    try {
      const result = await api<{ conversationId: string; messages: Message[] }>("/api/chat", { ...jsonRequest("POST", { message: trimmed, conversationId, timeZone: browserTimeZone() }), signal: controller.signal }, 120000);
      setMessages(current => [...current, ...result.messages]); setConversationId(result.conversationId); setQuestion("");
      if (!conversationId) setConversations(current => [{ id: result.conversationId, title: trimmed.slice(0, 80) }, ...current]);
      setStatus(current => current ? { ...current, ready: true } : current);
    } catch (cause) { if (!controller.signal.aborted) { setQuestion(trimmed); setError(cause instanceof Error ? cause.message : "Pesan belum berhasil dikirim."); } }
    finally { inFlight.current = false; setBusy(false); setPendingQuestion(""); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(question); }
  return <div className="content-wrap chat-page">
    <header className="page-heading"><h1>Bertanya ke Luna</h1><p>Teman diskusi untuk makanan dan kebiasaan kecilmu.</p></header>
    {mode === "demo" ? <div className="ui-alert"><span>Masuk untuk berbicara dengan AI dan menyimpan percakapanmu.</span><Link href="/login" className="ui-btn">Masuk akun <Icon name="arrow" size={16} /></Link></div> : <p className="luna-status"><span className={status?.ready ? "status-dot ready" : "status-dot"} />{loading ? "Memeriksa koneksi Luna…" : status?.ready ? "Luna siap menemanimu · AI terhubung" : "Luna belum terhubung · periksa pengaturan AI"}<button className="text-button" disabled={busy || loading} onClick={() => void load()}>Periksa ulang</button></p>}
    <div className="luna-layout">
      <aside className="conversation-list" aria-label="Percakapan tersimpan">
        <h2>Obrolanmu</h2><button className="ui-btn w-full" disabled={busy || loading} onClick={() => { setMessages([]); setConversationId(undefined); setQuestion(""); setError(""); }}>+ Percakapan baru</button>
        {conversations.length ? conversations.map(item => <button key={item.id} className="conversation-item" aria-pressed={item.id === conversationId} disabled={busy || loading} onClick={() => void load(item.id)}>{item.title}</button>) : <p className="field-help">Percakapan yang tersimpan akan muncul di sini.</p>}
      </aside>
      <section className="surface-panel luna-panel" aria-label="Chatbot makanan">
        <div className="luna-heading"><span className="luna-mark" aria-hidden="true"><Icon name="sparkle" size={28} /></span><div><h2>Luna</h2><p>Pendamping makananmu</p></div><Link href="/log" className="text-button">Catat makanan <Icon name="arrow" size={16} /></Link></div>
        <div className="chat-log" role="log" aria-label="Riwayat percakapan" aria-live="polite" aria-busy={loading || busy}>
          {!messages.length && !busy && <div className="chat-welcome"><span className="moon-orbit" aria-hidden="true"><Icon name="moon" size={48} /></span><h3>Mau makan apa hari ini?</h3><p>Ceritakan bahan yang kamu punya, menu yang kamu suka, atau tanyakan asupan harianmu.</p></div>}
          {messages.map(message => <div className={`ui-chat ${message.role === "user" ? "ui-chat-end" : "ui-chat-start"}`} key={message.id}><div className="ui-chat-header">{message.role === "user" ? "Kamu" : "Luna"}<time>{new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time></div><div className="ui-chat-bubble">{message.content}</div></div>)}
          {busy && <><div className="ui-chat ui-chat-end"><div className="ui-chat-header">Kamu</div><div className="ui-chat-bubble">{pendingQuestion}</div></div><p className="luna-thinking" role="status">Luna sedang menyusun saran…</p></>}<div ref={endRef} />
        </div>
        {!messages.length && <div className="chat-suggestions" aria-label="Pertanyaan contoh">{suggestions.map(suggestion => <button className="ui-btn" key={suggestion} onClick={() => setQuestion(suggestion)} disabled={busy}>{suggestion}<Icon name="arrow" size={14} /></button>)}</div>}
        {error && <p className="chat-error" role="alert">{error} Pesanmu tetap ada di bawah.</p>}
        <form className="chat-composer" onSubmit={submit}><label className="field-label" htmlFor="chat-question">Pesan untuk Luna<textarea className="ui-textarea w-full" id="chat-question" maxLength={500} rows={2} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Misalnya, aku punya telur dan bayam…" required disabled={busy || loading || mode === "demo" || messages.length >= 40} aria-describedby="chat-help" /></label><div className="chat-compose-actions"><p id="chat-help">{messages.length >= 40 ? "20 pertanyaan tercapai. Mulai obrolan baru." : `${question.length}/500 karakter`}</p><button className="ui-btn ui-btn-primary" disabled={!question.trim() || busy || loading || mode === "demo" || messages.length >= 40}>{busy ? "Menunggu Luna…" : "Kirim pesan"}<Icon name="arrow" size={16} /></button></div></form>
      </section>
    </div><p className="chat-footnote">Luna memakai catatan harian yang tersimpan di akun. Saran dan estimasi gizi perlu ditinjau; kebutuhan medis dibahas dengan tenaga kesehatan.</p>
  </div>;
}
