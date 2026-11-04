"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (register && !name.trim()) { setError("Isi nama yang ingin ditampilkan."); return; }
    if (register && password !== confirmation) { setError("Konfirmasi kata sandi belum sama."); return; }
    setError("");
    setPassword("");
    setConfirmation("");
    setComplete(true);
  }

  return <div className="auth-page">
    <Link className="brand" href="/" aria-label="CalTrack beranda"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span>cal<span className="brand-accent">track</span></span></Link>
    <div className="auth-layout">
      <section className="auth-intro"><h1>{register ? "Mulai kebiasaan baikmu." : "Kembali ke catatanmu."}</h1><p>Satu catatan makan setiap kali. Lebih kenal asupanmu, lebih mudah menjaga tujuanmu.</p><Link className="ui-btn ui-btn-ghost" href="/">Jelajahi dashboard demo</Link></section>
      <section className="auth-form-panel" aria-labelledby="auth-title">
        <h2 id="auth-title">{register ? "Daftar CalTrack" : "Masuk ke CalTrack"}</h2>
        <p className="demo-note">Pratinjau formulir. Akun belum dibuat dan kata sandi tidak dikirim atau disimpan.</p>
        {complete ? <div role="status" className="space-y-5"><h3 className="text-lg font-semibold">Formulir siap</h3><p>Validasi berhasil. Kamu dapat mencoba pencatatan dengan data contoh.</p><Link href="/" className="ui-btn ui-btn-primary w-full">Buka dashboard demo</Link><button className="ui-btn ui-btn-ghost w-full" onClick={() => setComplete(false)}>Kembali ke formulir</button></div> : <form onSubmit={submit} className="form-stack">
          {register && <label className="field-label" htmlFor="auth-name">Nama<input id="auth-name" className="ui-input w-full" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>}
          <label className="field-label" htmlFor="auth-email">Email<input id="auth-email" className="ui-input w-full" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@contoh.com" /></label>
          <label className="field-label" htmlFor="auth-password">Kata sandi<input id="auth-password" className="ui-input w-full" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : 1} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={register ? "password-help" : undefined} /></label>
          {register && <p id="password-help" className="field-help">Gunakan minimal 8 karakter.</p>}
          <button className="ui-btn ui-btn-ghost justify-self-start" type="button" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Sembunyikan" : "Tampilkan"} kata sandi</button>
          {register && <label className="field-label" htmlFor="auth-confirmation">Ulangi kata sandi<input id="auth-confirmation" className="ui-input w-full" type={showPassword ? "text" : "password"} autoComplete="new-password" required maxLength={128} value={confirmation} onChange={(e) => { setConfirmation(e.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "auth-error" : undefined} /></label>}
          {error && <p id="auth-error" className="ui-alert ui-alert-error" role="alert">{error}</p>}
          <button className="ui-btn ui-btn-primary w-full" type="submit">{register ? "Coba daftar" : "Coba masuk"}</button>
        </form>}
        {complete && register && <Link href="/onboarding" className="ui-btn ui-btn-ghost w-full mt-4">Atur profil dan target</Link>}
        <p className="auth-switch">{register ? "Sudah punya akun?" : "Baru di CalTrack?"} <Link href={register ? "/login" : "/register"}>{register ? "Masuk" : "Daftar"}</Link></p>
      </section>
    </div>
  </div>;
}
