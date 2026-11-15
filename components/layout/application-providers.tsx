"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardProvider } from "@/components/dashboard/dashboard-state";
import { AdventureProvider } from "@/components/adventure/adventure-state";
import { AppShell } from "./app-shell";

export function ApplicationProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Login and account recovery must remain available even without a session/database response.
  if (["/login", "/register", "/forgot-password", "/reset-password"].includes(pathname)) {
    return <main>{children}</main>;
  }
  return <DashboardProvider><AdventureProvider><AppShell>{children}</AppShell></AdventureProvider></DashboardProvider>;
}
