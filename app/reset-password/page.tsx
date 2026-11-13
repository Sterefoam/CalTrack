import type { Metadata } from "next";
import { PasswordRecovery } from "@/components/auth/password-recovery";

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
export default function ResetPasswordPage() { return <PasswordRecovery reset />; }
