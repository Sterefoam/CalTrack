import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardProvider } from "@/components/dashboard/dashboard-state";
import { AdventureProvider } from "@/components/adventure/adventure-state";

export const metadata: Metadata = {
  title: "CalTrack — Catatan Gizi Harian",
  description: "Pantau kalori dan nutrisi harianmu dengan lebih mudah."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-theme="caltrack">
      <body><DashboardProvider><AdventureProvider><AppShell>{children}</AppShell></AdventureProvider></DashboardProvider></body>
    </html>
  );
}
