import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../db/schema";
import { createAuth, type PasswordResetEmail } from "../lib/auth/service";
import { passwordResetSender } from "../lib/auth/password-email";
import { authenticateRequest } from "../lib/auth/request";

test("password recovery is private, expiring, single-use and revokes sessions and JWT", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    const origin = "http://localhost:3000";
    const outbox: PasswordResetEmail[] = [];
    const auth = createAuth(database, { secret: randomBytes(32).toString("base64url"), baseURL: origin, sendPasswordReset: async mail => { outbox.push(mail); } });
    const call = (path: string, body?: unknown, cookie?: string) => auth.handler(new Request(`${origin}/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }));
    const registered = await call("sign-up/email", { name: "Recovery", email: "recovery@example.test", password: "Before-reset-passphrase" });
    assert.equal(registered.status, 200);
    const cookie = registered.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    const { token: jwt } = await (await call("token", undefined, cookie)).json();
    const missing = await call("request-password-reset", { email: "missing@example.test", redirectTo: `${origin}/reset-password` });
    assert.equal(missing.status, 200);
    assert.equal(outbox.length, 0);
    const requested = await call("request-password-reset", { email: "recovery@example.test", redirectTo: `${origin}/reset-password` });
    assert.equal(requested.status, 200);
    assert.deepEqual(await requested.json(), await missing.json());
    assert.equal(outbox.length, 1);
    const verification = (await database.select().from(schema.verifications))[0];
    assert.ok(verification.expiresAt.getTime() - Date.now() <= 900000);
    assert.ok(verification.expiresAt.getTime() - Date.now() > 890000);
    const callback = await auth.handler(new Request(outbox[0].url));
    const location = new URL(callback.headers.get("location")!);
    assert.equal(location.origin, origin);
    assert.equal(location.pathname, "/reset-password");
    const token = location.searchParams.get("token");
    assert.ok(token);
    assert.equal((await call("reset-password", { token, newPassword: "short" })).status, 400);
    const reset = await call("reset-password", { token, newPassword: "After-reset-passphrase" });
    assert.equal(reset.status, 200);
    assert.equal((await database.select().from(schema.sessions)).length, 0);
    assert.equal((await database.select().from(schema.verifications)).length, 0);
    assert.equal((await call("get-session", undefined, cookie)).status, 200);
    assert.equal(await (await call("get-session", undefined, cookie)).json(), null);
    assert.equal(await authenticateRequest(new Request(`${origin}/api/profile`, { headers: { Authorization: `Bearer ${jwt}` } }), auth, database, origin), null);
    assert.equal((await call("reset-password", { token, newPassword: "Unwanted-passphrase" })).status, 400);
    assert.equal((await call("sign-in/email", { email: "recovery@example.test", password: "Before-reset-passphrase" })).status, 401);
    assert.equal((await call("sign-in/email", { email: "recovery@example.test", password: "After-reset-passphrase" })).status, 200);
    assert.equal((await call("request-password-reset", { email: "recovery@example.test", redirectTo: "https://untrusted.example.test/reset" })).status, 403);
    assert.equal(outbox.length, 1);
    const expiredToken = "expired-test-token";
    await database.insert(schema.verifications).values({ ...verification, id: "expired-test", identifier: `reset-password:${expiredToken}`, expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await call("reset-password", { token: expiredToken, newPassword: "Expired-passphrase" })).status, 400);
    assert.equal((await call("reset-password", { token: "invalid", newPassword: "Invalid-passphrase" })).status, 400);
  } finally { client.close(); }
});

test("reset email transport requires configuration and sends bounded plain-text messages without exposing errors", async () => {
  assert.equal(passwordResetSender({}), undefined);
  assert.equal(passwordResetSender({ apiKey: "test-key" }), undefined);
  let calls = 0;
  const send = passwordResetSender({ apiKey: "test-key", from: "CalTrack <auth@example.test>" }, async (input, init) => {
    calls++;
    assert.equal(input, "https://api.resend.com/emails");
    assert.ok(init?.signal);
    const body = JSON.parse(init?.body as string);
    assert.deepEqual(body.to, ["account@example.test"]);
    assert.ok(body.text.includes("https://app.example.test/reset"));
    return new Response("private provider error", { status: 500 });
  });
  await assert.rejects(() => send!({ to: "account@example.test", url: "https://app.example.test/reset" }), { message: "password_email_delivery_failed" });
  assert.equal(calls, 1);
});
