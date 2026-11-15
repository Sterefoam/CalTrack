"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { api, jsonRequest } from "@/lib/client/api";
import { useAdventure } from "@/components/adventure/adventure-state";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Markas", icon: "grid" },
  { href: "/log", label: "Catat makan", icon: "book" },
  { href: "/quests", label: "Quest & hadiah", icon: "sparkle" },
  { href: "/chat", label: "Luna AI", icon: "moon" },
  { href: "/history", label: "Riwayat", icon: "clock" },
  { href: "/recipes", label: "Resep", icon: "book" },
  { href: "/profile", label: "Profil", icon: "settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, mode, hasProfile } = useDashboardState();
  const { adventure } = useAdventure();
  const [accountError, setAccountError] = useState("");
  const initials = profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const [today, setToday] = useState("");
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/profile" && ["/targets", "/settings"].includes(pathname));
  const current = pathname === "/settings" ? "Pengaturan" : pathname === "/targets" ? "Target harian" : pathname.startsWith("/recipes") ? "Resep harian" : navigation.find((item) => active(item.href))?.label ?? "CalTrack";
  useEffect(() => {
    const update = () => setToday(new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (["/login", "/register", "/forgot-password", "/reset-password"].includes(pathname)) return <main>{children}</main>;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Lewati ke konten</a>
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="CalTrack beranda">
        <span className="brand-mark" aria-hidden="true"><Icon name="moon" size={26} /></span>
        <span>CalTrack<span className="brand-subline">Your little food adventure</span></span>
      </Link>
      <nav className="primary-nav" aria-label="Menu utama">
        <ul className="ui-menu w-full p-0 gap-1">
          {navigation.map((item) => <li key={item.href}>
            <Link href={item.href} aria-label={item.label} title={item.label} aria-current={active(item.href) ? "page" : undefined} className={`nav-item ${active(item.href) ? "active" : ""}`}>
              <Icon name={item.icon} size={20} /><span>{item.label}</span>
            </Link>
          </li>)}
        </ul>
      </nav>
      <div className="sidebar-spacer" />
      <Link href="/quests" className="shell-note"><span className="sidebar-level">Level {adventure?.level ?? 1}</span><strong>Penjelajah malam</strong><progress className="ui-progress" value={adventure?.levelXp ?? 0} max={100} aria-label="XP level penjelajah" /><p>{adventure?.levelXp ?? 0}/100 XP ke level berikutnya</p></Link>
      <Link href={mode === "account" ? "/profile" : "/login"} className="profile-row" aria-label={mode === "account" ? "Profil akun" : "Masuk ke akun"}><div className="avatar">{mode === "account" ? initials : "CT"}</div><div className="profile-copy"><strong>{mode === "account" ? profile.name : "Masuk ke CalTrack"}</strong><span>{mode === "account" ? "Akun terhubung" : "Simpan catatan di akunmu"}</span></div></Link>
    </aside>
    <div className="main-area">
      <header className="topbar ui-navbar">
        <div className="breadcrumb"><Link href="/">CalTrack</Link><Icon name="chevron" size={16} /><strong>{current}</strong></div>
        <div className="topbar-right"><time className="shell-date">{today}</time>{mode === "demo" && <Link href="/login" className="ui-btn ui-btn-primary shell-login">Masuk</Link>}<details className="shell-menu"><summary>Menu <Icon name="chevron" size={14} /></summary><ul className="ui-menu">{navigation.map(item => <li key={item.href}><Link href={item.href} onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>{item.label}</Link></li>)}<li><Link href="/settings">Pengaturan</Link></li></ul></details></div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {mode === "demo" && <div className="content-wrap demo-access-strip"><p><strong>Anda sedang melihat data contoh.</strong> Masuk atau daftar untuk mencatat makanan dan menyimpan hadiah sendiri.</p><div><Link href="/login" className="ui-btn ui-btn-primary">Masuk akun</Link><Link href="/register" className="ui-btn ui-btn-ghost">Daftar gratis</Link></div></div>}
        {mode === "account" && <div className="content-wrap account-strip"><div className="flex flex-wrap items-center justify-between gap-3"><p>{profile.name} · Akun terhubung</p><button className="text-button" onClick={async () => { try { await api("/api/auth/sign-out", jsonRequest("POST", {})); window.location.assign("/login"); } catch { setAccountError("Belum berhasil keluar. Coba lagi."); } }}>Keluar akun</button></div>{!hasProfile && <p className="ui-alert mt-3">Target belum diatur. <Link href="/onboarding">Lengkapi profil</Link></p>}{accountError && <p role="alert">{accountError}</p>}</div>}
        {children}
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Navigasi cepat">
      {navigation.filter(item => !["/history", "/recipes"].includes(item.href)).map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} /><span>{item.href === "/quests" ? "Quest" : item.label}</span></Link>)}
    </nav>
  </div>;
}
