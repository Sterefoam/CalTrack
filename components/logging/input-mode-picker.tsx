"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modes = [{ href: "/log/photo", label: "Foto" }, { href: "/log/text", label: "Teks" }, { href: "/log/voice", label: "Suara" }, { href: "/log/barcode", label: "Barcode" }, { href: "/log/search", label: "Cari makanan" }, { href: "/log/favorites", label: "Favorit" }];

export function InputModePicker() {
  const pathname = usePathname();
  return <nav className="input-modes" aria-label="Cara mencatat makanan">{modes.map((mode) => <Link key={mode.href} href={mode.href} className={`ui-btn ${pathname === mode.href ? "ui-btn-primary" : ""}`} aria-current={pathname === mode.href ? "page" : undefined}>{mode.label}</Link>)}</nav>;
}
