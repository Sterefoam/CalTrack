"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { jsonRequest } from "@/lib/client/api";

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const readToken = useRef(false);
  useEffect(() => {
    if (!reset || readToken.current) return;
    readToken.current = true;
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
    if (!params.get("token") || params.has("error")) setError("Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
    // Keep the credential out of copied URLs, browser history and subsequent referrers.
    window.history.replaceState(null, "", "/reset-password");
  }, [reset]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (reset && password !== confirmation) { setError("Konfirmasi kata sandi belum sama."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${reset ? "reset-password" : "request-password-reset"}`, {
        ...jsonRequest("POST", reset ? { token, newPassword: password } : { email: email.trim(), redirectTo: `${window.location.origin}/reset-password` }),
        credentials: "same-origin", signal: AbortSignal.timeout(15000)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 429) throw new Error("Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.");
        if (result?.error === "password_reset_unavailable") throw new Error("Layanan email pemulihan belum tersedia. Hubungi pengelola CalTrack.");
        throw new Error(reset ? "Tautan tidak valid atau kedaluwarsa, atau kata sandi belum memenuhi syarat. Minta tautan baru jika perlu." : "Permintaan belum berhasil. Coba lagi nanti.");
      }
      setPassword(""); setConfirmation(""); setToken(""); setDone(true);
    } catch (failure) { setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "Koneksi belum berhasil. Coba lagi nanti."); }
    finally { setBusy(false); }
  }

  return <div className="auth-page">
    <Link className="brand" href="/">cal<span className="brand-accent">track</span></Link>
    <section className="auth-form-panel mx-auto max-w-lg" aria-labelledby="recovery-title">
      <h1 id="recovery-title">{reset ? "Buat kata sandi baru" : "Lupa kata sandi?"}</h1>
      {done ? <div role="status" className="ui-alert ui-alert-success">{reset ? "Kata sandi berhasil diganti. Masuk kembali dengan kata sandi baru." : "Jika email terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan spam. Tautan berlaku 15 menit."}</div> : <form onSubmit={submit} className="form-stack mt-4">
        {reset ? <>
          <p className="field-help">Gunakan 8–128 karakter. Semua sesi lama akan diakhiri.</p>
          <label className="field-label" htmlFor="recovery-password">Kata sandi baru<input id="recovery-password" className="ui-input w-full" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>
          <label className="field-label" htmlFor="recovery-confirmation">Ulangi kata sandi<input id="recovery-confirmation" className="ui-input w-full" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        </> : <label className="field-label" htmlFor="recovery-email">Email akun<input id="recovery-email" className="ui-input w-full" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>}
        {error && <p className="ui-alert ui-alert-error" role="alert">{error}</p>}
        <button className="ui-btn ui-btn-primary w-full" type="submit" disabled={busy || (reset && !token)}>{busy ? "Memproses..." : reset ? "Simpan kata sandi" : "Kirim tautan pemulihan"}</button>
      </form>}
      <p className="auth-switch"><Link href="/login">Kembali ke masuk</Link>{reset && !done && <> · <Link href="/forgot-password">Minta tautan baru</Link></>}</p>
    </section>
  </div>;
}
