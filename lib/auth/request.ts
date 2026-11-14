import { and, eq, gt } from "drizzle-orm";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { db } from "@/db/client";
import { jwks, sessions } from "@/db/schema";
import type { AuthService } from "./service";
import { authOrigin, AuthConfigurationError, getAuth } from "./server";

export async function authenticateRequest(request: Request, auth: AuthService, database: typeof db, origin: string): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    if (!authorization.startsWith("Bearer ") || authorization.length > 8192) return null;
    try {
      const token = authorization.slice(7);
      const { kid } = decodeProtectedHeader(token);
      if (!kid) return null;
      const [key] = await database.select().from(jwks).where(eq(jwks.id, kid)).limit(1);
      if (!key) return null;
      const publicKey = await importJWK(JSON.parse(key.publicKey), "EdDSA");
      const { payload } = await jwtVerify(token, publicKey, { issuer: origin, audience: origin, algorithms: ["EdDSA"] });
      if (!payload.sub || typeof payload.sid !== "string") return null;
      const [session] = await database.select({ userId: sessions.userId }).from(sessions).where(and(eq(sessions.id, payload.sid), eq(sessions.userId, payload.sub), gt(sessions.expiresAt, new Date()))).limit(1);
      return session?.userId ?? null;
    } catch { return null; }
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin !== origin || request.headers.get("sec-fetch-site") === "cross-site") return null;
  }
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function requireUser(request: Request): Promise<{ userId: string } | Response> {
  try {
    const userId = await authenticateRequest(request, getAuth(), db, authOrigin());
    return userId ? { userId } : Response.json({ error: "authentication_required" }, { status: 401 });
  } catch (error) {
    return Response.json({ error: error instanceof AuthConfigurationError ? "auth_not_configured" : "auth_unavailable" }, { status: 503 });
  }
}
