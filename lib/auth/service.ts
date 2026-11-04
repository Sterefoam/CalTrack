import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import type { db } from "@/db/client";
import { accounts, jwks, sessions, users, verifications } from "@/db/schema";

export function createAuth(database: typeof db, options: { secret: string; baseURL: string; production?: boolean }) {
  return betterAuth({
    appName: "CalTrack",
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: [options.baseURL],
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema: { user: users, session: sessions, account: accounts, verification: verifications, jwks }
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
    user: {
      additionalFields: {
        // Existing column is retained for old data. New hashes live in accounts.password.
        passwordHash: { type: "string", required: false, input: false, returned: false, defaultValue: "" }
      }
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: options.production ?? false },
    rateLimit: { enabled: true, window: 60, max: 50, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 5 } } },
    plugins: [jwt({ jwt: {
      issuer: options.baseURL,
      audience: options.baseURL,
      expirationTime: "15m",
      definePayload: ({ user, session }) => ({ sub: user.id, sid: session.id })
    } })]
  });
}

export type AuthService = ReturnType<typeof createAuth>;
