"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { api, jsonRequest } from "@/lib/client/api";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/log", label: "Catatan makan", icon: "book" },
  { href: "/history", label: "Riwayat", icon: "clock" },
  { href: "/chat", label: "Asisten", icon: "sparkle" },
  { href: "/profile", label: "Profil", icon: "settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, mode, hasProfile } = useDashboardState();
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
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span>cal<span className="brand-accent">track</span></span>
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
      <div className="shell-note"><strong>Sedikit demi sedikit.</strong><p>Catat yang kamu makan, kenali kebutuhan tubuhmu.</p></div>
      <Link href={mode === "account" ? "/profile" : "/login"} className="profile-row" aria-label={mode === "account" ? "Profil akun" : "Masuk ke akun"}><div className="avatar">{initials}</div><div className="profile-copy"><strong>{profile.name}</strong><span>{mode === "account" ? "Akun terhubung" : "Mode demo · Masuk"}</span></div></Link>
    </aside>
    <div className="main-area">
      <header className="topbar ui-navbar">
        <div className="breadcrumb"><Link href="/">CalTrack</Link><Icon name="chevron" size={16} /><strong>{current}</strong></div>
        <time className="shell-date">{today}</time>
      </header>
      <main id="main-content" tabIndex={-1}>
        {mode === "account" && <div className="content-wrap pb-0!"><div className="flex flex-wrap items-center justify-between gap-3"><p>Catatan makanan tersimpan di akunmu.</p><button className="ui-btn ui-btn-ghost" onClick={async () => { try { await api("/api/auth/sign-out", jsonRequest("POST", {})); window.location.assign("/login"); } catch { setAccountError("Belum berhasil keluar. Coba lagi."); } }}>Keluar akun</button></div>{!hasProfile && <p className="ui-alert mt-3">Target belum diatur. <Link href="/onboarding">Lengkapi profil</Link></p>}{accountError && <p role="alert">{accountError}</p>}</div>}
        {children}
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Navigasi cepat">
      {navigation.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}
    </nav>
  </div>;
}
