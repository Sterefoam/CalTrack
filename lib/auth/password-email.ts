import type { PasswordResetEmail } from "./service";

/** Returns no transport until both the provider key and verified sender are configured. */
export function passwordResetSender(config: { apiKey?: string; from?: string }, transport: typeof fetch = fetch) {
  if (!config.apiKey?.trim() || !config.from?.trim()) return undefined;
  return async ({ to, url }: PasswordResetEmail) => {
    const response = await transport("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: config.from, to: [to], subject: "Atur ulang kata sandi CalTrack",
        text: `Buka tautan ini untuk mengganti kata sandi CalTrack:\n\n${url}\n\nTautan berlaku 15 menit dan hanya dapat digunakan sekali. Jika kamu tidak meminta perubahan, abaikan email ini.`
      })
    });
    // Provider response may contain addresses or request details; never forward it to logs/clients.
    if (!response.ok) throw new Error("password_email_delivery_failed");
  };
}
