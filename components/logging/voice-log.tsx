"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { InputModePicker } from "./input-mode-picker";
import { createFoodDraft } from "@/lib/logging/food-draft";
import { analyzeFoodVoice } from "@/lib/logging/voice-analysis-client";
import { api, type AnalysisResponse } from "@/lib/client/api";

export function VoiceLog() {
  const { voiceRecording, setVoiceRecording, setFoodDraft, mode } = useDashboardState();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "starting" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  const parseController = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      parseController.current?.abort();
      if (recorder.current) { recorder.current.onstop = null; recorder.current.onerror = null; if (recorder.current.state !== "inactive") recorder.current.stop(); }
      release();
    };
  }, []);
  useEffect(() => {
    if (!voiceRecording) { setAudioUrl(""); return; }
    const url = URL.createObjectURL(voiceRecording);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [voiceRecording]);

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Browser ini belum mendukung rekaman suara. Gunakan input teks atau coba browser lain."); return; }
    setStatus("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const capture = new MediaRecorder(media);
      recorder.current = capture;
      const chunks: BlobPart[] = [];
      capture.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      capture.onstop = () => {
        release();
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type: capture.mimeType });
        if (blob.size) setVoiceRecording(blob);
        else setError("Rekaman kosong. Coba rekam kembali.");
        setStatus("idle");
      };
      capture.onerror = () => { capture.onstop = null; if (capture.state !== "inactive") capture.stop(); release(); if (mounted.current) { setStatus("idle"); setError("Rekaman terhenti. Coba lagi atau tulis makananmu."); } };
      capture.start();
      setVoiceRecording(null);
      setSeconds(0);
      setStatus("recording");
      const started = Date.now();
      timer.current = setInterval(() => { const elapsed = Math.min(60, Math.floor((Date.now() - started) / 1000)); setSeconds(elapsed); if (elapsed >= 60 && capture.state === "recording") capture.stop(); }, 250);
    } catch (cause) {
      release();
      if (!mounted.current) return;
      setStatus("idle");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Izin mikrofon belum diberikan. Izinkan mikrofon di pengaturan browser atau gunakan input teks." : "Mikrofon tidak dapat dibuka. Periksa perangkat lalu coba kembali.");
    }
  }

  async function analyze() {
    if (!voiceRecording || parsing) return;
    const run = new AbortController();
    parseController.current = run;
    setParsing(true); setError("");
    try {
      let result: AnalysisResponse;
      if (mode === "account") {
        const body = new FormData(); body.set("audio", new File([voiceRecording], "recording", { type: voiceRecording.type }));
        result = await api<AnalysisResponse>("/api/analyze/voice", { method: "POST", body, signal: run.signal });
      } else result = await analyzeFoodVoice({ audio: voiceRecording }, run.signal);
      if (run.signal.aborted) return;
      setFoodDraft({ ...createFoodDraft("voice", result.items, result.confidenceScore), ...(mode === "account" ? { origin: "analysis" as const, notes: result.transcript?.slice(0,500) ?? "" } : {}) });
      router.push("/log/review");
    } catch (cause) {
      if (!run.signal.aborted) setError(cause instanceof Error ? cause.message : "Hasil belum berhasil disiapkan. Coba lagi.");
    } finally { if (!run.signal.aborted) setParsing(false); }
  }

  return <div className="content-wrap logging-page"><header className="page-heading"><h1>Ceritakan lewat suara</h1><p>Sebutkan makanan, porsi, dan cara memasaknya dengan santai.</p></header><InputModePicker />
    <p className="demo-note">{mode === "account" ? "Rekaman dikirim ke server dan layanan AI hanya setelah kamu menekan Analisis rekaman." : "Rekaman hanya disimpan di sesi browser ini. Audio belum dikirim atau ditranskripsikan oleh AI."}</p>
    <section className="surface-panel voice-panel"><h2>Rekam makananmu</h2><p className="photo-description">Misalnya, “Tadi siang makan nasi, ayam panggang, dan sayur.” Maksimal 60 detik.</p>
      <div className="voice-status" role="status">{status === "starting" ? "Menunggu izin mikrofon..." : status === "recording" ? `Sedang merekam · ${seconds} / 60 detik` : voiceRecording ? "Rekaman siap diputar" : "Siap saat kamu ingin bercerita"}</div>
      <div className="text-log-actions">{status === "recording" ? <button className="ui-btn ui-btn-primary" onClick={() => { if (recorder.current?.state === "recording") recorder.current.stop(); }}>Hentikan rekaman</button> : <button className="ui-btn ui-btn-primary" onClick={start} disabled={status === "starting" || parsing}>{voiceRecording ? "Rekam ulang" : "Mulai rekam"}</button>}{voiceRecording && status === "idle" && <button className="ui-btn" disabled={parsing} onClick={() => { setVoiceRecording(null); setSeconds(0); setError(""); }}>Hapus rekaman</button>}</div>
      {audioUrl && <audio className="voice-player" controls src={audioUrl} aria-label="Putar rekaman makanan" />}
      {voiceRecording && status === "idle" && <div className="mt-6"><p className="photo-description">{mode === "account" ? "Tinjau estimasi makanan dari transkripsi rekaman sebelum menyimpan." : "Hasil simulasi memakai nasi, ayam, dan sayur contoh, belum berasal dari isi rekamanmu."}</p>{parsing ? <><p role="status">{mode === "account" ? "Mentranskripsikan dan menganalisis..." : "Menyiapkan hasil contoh..."}</p><button className="ui-btn" onClick={() => { parseController.current?.abort(); setParsing(false); }}>Batalkan</button></> : <button className="ui-btn ui-btn-primary" onClick={analyze}>{mode === "account" ? "Analisis rekaman" : "Tinjau hasil contoh"}</button>}</div>}
      {error && <p className="ui-alert ui-alert-error mt-6" role="alert">{error}</p>}
      <Link className="ui-btn ui-btn-ghost mt-6" href="/log/text">Catat lewat teks</Link>
    </section>
  </div>;
}
