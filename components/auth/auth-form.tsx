"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, jsonRequest } from "@/lib/client/api";
import { Icon } from "@/components/layout/icon";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (register && !name.trim()) { setError("Isi nama yang ingin ditampilkan."); return; }
    if (register && password !== confirmation) { setError("Konfirmasi kata sandi belum sama."); return; }
    if (busy) return;
    setError(""); setBusy(true);
    try {
      await api(`/api/auth/${register ? "sign-up" : "sign-in"}/email`, jsonRequest("POST", { email: email.trim(), password, ...(register ? { name: name.trim() } : {}) }));
      setPassword(""); setConfirmation("");
      window.location.assign(register ? "/onboarding" : "/");
    } catch { setError(register ? "Pendaftaran gagal. Periksa data atau gunakan email lain." : "Email atau kata sandi tidak sesuai, atau layanan akun sedang tidak tersedia."); setBusy(false); }
  }

  return <div className="auth-page">
    <Link className="brand" href="/login" aria-label="CalTrack beranda"><span className="brand-mark" aria-hidden="true"><Icon name="moon" size={26} /></span><span>CalTrack</span></Link>
    <div className="auth-layout">
      <section className="auth-intro"><h1>{register ? "Mulai kebiasaan baikmu." : "Kembali ke catatanmu."}</h1><p>Catat makanan, temui Luna, dan lanjutkan quest harianmu. Profil, catatan, dan hadiah tersimpan di akunmu.</p></section>
      <section className="auth-form-panel" aria-labelledby="auth-title">
        <h2 id="auth-title">{register ? "Daftar CalTrack" : "Masuk ke CalTrack"}</h2>
        <p className="demo-note">Masuk untuk menyimpan profil dan catatan makanan di akunmu.</p>
        <form onSubmit={submit} className="form-stack">
          {register && <label className="field-label" htmlFor="auth-name">Nama<input id="auth-name" className="ui-input w-full" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>}
          <label className="field-label" htmlFor="auth-email">Email<input id="auth-email" className="ui-input w-full" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@contoh.com" /></label>
          <label className="field-label" htmlFor="auth-password">Kata sandi<input id="auth-password" className="ui-input w-full" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : 1} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={register ? "password-help" : undefined} /></label>
          {register && <p id="password-help" className="field-help">Gunakan minimal 8 karakter.</p>}
          <button className="ui-btn ui-btn-ghost justify-self-start" type="button" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Sembunyikan" : "Tampilkan"} kata sandi</button>
          {register && <label className="field-label" htmlFor="auth-confirmation">Ulangi kata sandi<input id="auth-confirmation" className="ui-input w-full" type={showPassword ? "text" : "password"} autoComplete="new-password" required maxLength={128} value={confirmation} onChange={(e) => { setConfirmation(e.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "auth-error" : undefined} /></label>}
          {error && <p id="auth-error" className="ui-alert ui-alert-error" role="alert">{error}</p>}
          <button className="ui-btn ui-btn-primary w-full" type="submit" disabled={busy}>{busy ? "Memproses..." : register ? "Daftar" : "Masuk"}</button>
        </form>
        {!register && <p className="auth-switch"><Link href="/forgot-password">Lupa kata sandi?</Link></p>}
        <p className="auth-switch">{register ? "Sudah punya akun?" : "Baru di CalTrack?"} <Link href={register ? "/login" : "/register"}>{register ? "Masuk" : "Daftar"}</Link></p>
        <p className="auth-switch auth-demo-link"><Link href="/?demo=1">Lihat contoh tanpa akun</Link><span>Mode demo memakai data contoh.</span></p>
      </section>
    </div>
  </div>;
}
