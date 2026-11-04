import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/db/client";
import { createAuth } from "./service";

export class AuthConfigurationError extends Error {}
let instance: ReturnType<typeof createAuth> | undefined;
function developmentSecret() {
  const directory = join(process.cwd(), ".caltrack");
  const path = join(directory, "auth-secret");
  mkdirSync(directory, { recursive: true });
  if (!existsSync(path)) {
    try { writeFileSync(path, randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o600 }); }
    catch (error) { if (!existsSync(path)) throw error; }
  }
  return readFileSync(path, "utf8").trim();
}

export function authOrigin() {
  const baseURL = process.env.BETTER_AUTH_URL ?? (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined);
  if (!baseURL) throw new AuthConfigurationError("BETTER_AUTH_URL belum dikonfigurasi.");
  return new URL(baseURL).origin;
}

export function getAuth() {
  if (instance) return instance;
  const secret = process.env.BETTER_AUTH_SECRET ?? (process.env.NODE_ENV !== "production" ? developmentSecret() : undefined);
  if (!secret || secret.length < 32) throw new AuthConfigurationError("BETTER_AUTH_SECRET minimal 32 karakter diperlukan.");
  instance = createAuth(db, { secret, baseURL: authOrigin(), production: process.env.NODE_ENV === "production" });
  return instance;
}
