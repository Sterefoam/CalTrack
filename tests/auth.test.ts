import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { decodeJwt } from "jose";
import * as schema from "../db/schema";
import { createAuth } from "../lib/auth/service";
import { authenticateRequest } from "../lib/auth/request";

test("email auth, session cookies, JWT verification, origin checks, and revocation", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    const origin = "http://localhost:3000";
    const auth = createAuth(database, { secret: randomBytes(32).toString("base64url"), baseURL: origin });
    const call = (path: string, body?: unknown, cookie?: string) => auth.handler(new Request(`${origin}/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }));
    const registered = await call("sign-up/email", { name: "Test", email: "auth@example.test", password: "Testing-passphrase-123" });
    assert.equal(registered.status, 200);
    const cookie = registered.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    assert.ok(cookie);
    assert.ok(registered.headers.getSetCookie().some(value => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)));
    const account = await registered.json();
    assert.equal(account.user.passwordHash, undefined);
    assert.equal((await database.select().from(schema.accounts))[0].password?.includes("Testing-passphrase"), false);
    const wrong = await call("sign-in/email", { email: "auth@example.test", password: "wrong-password" });
    assert.equal(wrong.status, 401);
    const signedIn = await call("sign-in/email", { email: "auth@example.test", password: "Testing-passphrase-123" });
    assert.equal(signedIn.status, 200);
    const weak = await call("sign-up/email", { name: "Weak", email: "weak@example.test", password: "short" });
    assert.equal(weak.status, 400);
    const session = await call("get-session", undefined, cookie);
    assert.equal((await session.json()).user.id, account.user.id);
    const tokenResponse = await call("token", undefined, cookie);
    assert.equal(tokenResponse.status, 200);
    const { token } = await tokenResponse.json();
    const claims = decodeJwt(token);
    assert.equal(claims.sub, account.user.id);
    assert.equal(typeof claims.sid, "string");
    assert.ok((claims.exp ?? 0) - (claims.iat ?? 0) <= 900);
    assert.equal(claims.email, undefined);
    assert.equal(claims.passwordHash, undefined);
    const bearer = new Request(`${origin}/api/dashboard/daily?userId=someone-else`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(await authenticateRequest(bearer, auth, database, origin), account.user.id);
    const tampered = new Request(`${origin}/api/dashboard/daily`, { headers: { Authorization: `Bearer ${token.slice(0,-12)}invalidtoken` } });
    assert.equal(await authenticateRequest(tampered, auth, database, origin), null);
    assert.equal(await authenticateRequest(bearer, auth, database, "http://other.example.test"), null);
    assert.equal(await authenticateRequest(new Request(`${origin}/api/food-logs`, { method: "POST", headers: { Cookie: cookie, Origin: "https://untrusted.example.test" } }), auth, database, origin), null);
    assert.equal(await authenticateRequest(new Request(`${origin}/api/food-logs`, { method: "POST", headers: { Cookie: cookie } }), auth, database, origin), null);
    assert.equal(await authenticateRequest(new Request(`${origin}/api/food-logs`, { method: "POST", headers: { Cookie: cookie, Origin: "null" } }), auth, database, origin), null);
    assert.equal(await authenticateRequest(new Request(`${origin}/api/food-logs`, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Sec-Fetch-Site": "cross-site" } }), auth, database, origin), null);
    assert.equal(await authenticateRequest(new Request(`${origin}/api/food-logs`, { method: "POST", headers: { Cookie: cookie, Origin: origin } }), auth, database, origin), account.user.id);
    assert.equal(await authenticateRequest(new Request(`${origin}/api/food-logs`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }), auth, database, origin), account.user.id);
    const signedOut = await call("sign-out", {}, cookie);
    assert.equal(signedOut.status, 200);
    assert.equal(await authenticateRequest(bearer, auth, database, origin), null);
    assert.equal(await authenticateRequest(new Request(`${origin}/api/dashboard/daily`, { headers: { Cookie: cookie } }), auth, database, origin), null);
  } finally { client.close(); }
});
