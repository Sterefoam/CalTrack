import type { Metadata } from "next";
import "./globals.css";
import "./night.css";
import "./avatar.css";
import { ApplicationProviders } from "@/components/layout/application-providers";

export const metadata: Metadata = {
  title: "CalTrack — Catatan Gizi Harian",
  description: "Pantau kalori dan nutrisi harianmu dengan lebih mudah."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-theme="caltrack">
      <body><ApplicationProviders>{children}</ApplicationProviders></body>
    </html>
  );
}
