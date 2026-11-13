import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

// Requires a completed `npm run build`. All writes go to a disposable local DB.
const root = fileURLToPath(new URL("../", import.meta.url));
const databasePath = process.argv[2] === "--prepare" ? resolve(process.argv[3] ?? "") : join(root, ".caltrack", `smoke-${randomUUID()}.db`);
assert.equal(dirname(databasePath), join(root, ".caltrack"));
assert.match(basename(databasePath), /^smoke-[a-f0-9-]+\.db$/);
const port = Number(process.env.SMOKE_PORT ?? 3101);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, "Invalid SMOKE_PORT");
const origin = `http://127.0.0.1:${port}`;
await mkdir(new URL("../.caltrack/", import.meta.url), { recursive: true });
if (process.argv[2] === "--prepare") {
  const client = createClient({ url: `file:${databasePath}` });
  try {
    await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)) });
    await client.execute("INSERT INTO foods (id,name,serving_size_g,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,sugar_per_100g,sodium_per_100g,source) VALUES ('smoke-rice','Nasi uji HTTP',100,130,2.5,28,0.3,0.4,0.1,1,'manual')");
  } finally { client.close(); }
  process.exit(0);
}
let server, checks = 0;
try {
  // Native SQLite handles can retain file locks until process exit on Windows.
  const prepared = spawn(process.execPath, [fileURLToPath(import.meta.url), "--prepare", databasePath], { cwd: root, windowsHide: true, stdio: "ignore" });
  const code = await new Promise((resolve, reject) => { prepared.once("error", reject); prepared.once("exit", resolve); });
  assert.equal(code, 0, "Disposable database preparation failed");
  server = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, DATABASE_URL: `file:${databasePath}`, BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"), OPENAI_API_KEY: "", RESEND_API_KEY: "", AUTH_EMAIL_FROM: "", NODE_ENV: "production" }
  });
  server.stdout.resume(); server.stderr.resume();
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Smoke server exited before readiness");
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Smoke server readiness timed out");
  async function call(path, { method = "GET", cookie, body, token, expected = 200 } = {}) {
    const response = await fetch(origin + path, { method, signal: AbortSignal.timeout(10000),
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(response.status, expected, `${method} ${path}`); checks++;
    return response;
  }
  await call("/api/profile", { expected: 401 });
  async function register(label) {
    const response = await call("/api/auth/sign-up/email", { method: "POST", body: { name: label, email: `${label}@example.test`, password: randomBytes(24).toString("base64url") } });
    const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    assert.ok(cookie, "Registration session cookie missing");
    return { cookie, user: (await response.json()).user };
  }
  const owner = await register("http-owner"); const other = await register("http-other");
  for (const email of ["http-owner@example.test", "missing@example.test"]) {
    const unavailable = await call("/api/auth/request-password-reset", { method: "POST", body: { email }, expected: 503 });
    assert.equal((await unavailable.json()).error, "password_reset_unavailable");
  }
  const profile = await (await call("/api/profile", { method: "PUT", cookie: owner.cookie, body: { name: "HTTP Test", age: 28, gender: "male", weightKg: 75, heightCm: 175, activityLevel: "light", goal: "maintenance" } })).json();
  assert.equal(profile.targets.calories, 2350);
  assert.equal((await (await call("/api/profile", { cookie: owner.cookie })).json()).profile.name, "HTTP Test");
  const token = (await (await call("/api/auth/token", { cookie: owner.cookie })).json()).token;
  assert.equal(typeof token, "string");
  const log = await (await call("/api/food-logs", { method: "POST", token, body: { mealType: "lunch", inputMethod: "search", items: [{ foodId: "smoke-rice", weightGrams: 150, calories: 1 }] }, expected: 201 })).json();
  assert.equal(log.totals.calories, 195);
  let daily = await (await call(`/api/dashboard/daily?userId=${other.user.id}`, { cookie: owner.cookie })).json();
  assert.equal(daily.calories.consumed, 195); assert.equal(daily.calories.remaining, 2155);
  await call(`/api/food-logs/${log.id}`, { cookie: other.cookie, expected: 404 });
  await call(`/api/food-logs/${log.id}`, { method: "DELETE", cookie: other.cookie, expected: 404 });
  await call(`/api/food-logs/${log.id}`, { method: "PATCH", cookie: owner.cookie, body: { items: [{ foodId: "smoke-rice", weightGrams: 75 }] } });
  const history = await (await call("/api/food-logs?limit=1", { cookie: owner.cookie })).json();
  assert.equal(history.logs[0].items[0].calories, 97.5); assert.equal(history.summary.calories, 97.5);
  const favorite = await (await call("/api/favorites", { method: "POST", cookie: owner.cookie, body: { inputMethod: "search", items: [{ foodId: "smoke-rice", weightGrams: 150 }] }, expected: 201 })).json();
  assert.equal(favorite.items[0].calories, 195);
  assert.equal((await (await call("/api/favorites?q=NASI", { cookie: owner.cookie })).json()).favorites.length, 1);
  assert.equal((await (await call("/api/favorites", { cookie: other.cookie })).json()).favorites.length, 0);
  await call(`/api/favorites/${favorite.id}`, { method: "DELETE", cookie: other.cookie, expected: 404 });
  await call(`/api/favorites/${favorite.id}`, { method: "DELETE", cookie: owner.cookie, expected: 204 });
  assert.equal((await (await call("/api/foods?q=tidak-ada", { cookie: owner.cookie })).json()).foods.length, 0);
  await call("/api/foods/barcode/invalid", { cookie: owner.cookie, expected: 400 });
  await call("/api/analyze/text", { method: "POST", cookie: owner.cookie, body: { text: "nasi 1 porsi" }, expected: 503 });
  await call(`/api/food-logs/${log.id}`, { method: "DELETE", cookie: owner.cookie, expected: 204 });
  daily = await (await call("/api/dashboard/daily", { cookie: owner.cookie })).json(); assert.equal(daily.calories.consumed, 0);
  assert.equal((await (await call("/api/dashboard/daily", { cookie: other.cookie })).json()).calories.consumed, 0);
  await call("/api/profile", { method: "DELETE", cookie: owner.cookie, expected: 204 });
  assert.equal(await (await call("/api/profile", { cookie: owner.cookie })).json(), null);
  assert.equal((await (await call("/api/dashboard/daily", { cookie: owner.cookie })).json()).calories.target, 0);
  await call("/api/auth/sign-out", { method: "POST", cookie: owner.cookie, body: {} });
  await call("/api/profile", { token, expected: 401 });
  await call("/api/profile", { cookie: owner.cookie, expected: 401 });
} finally {
  if (server && server.exitCode === null) {
    const closed = new Promise(resolve => server.once("exit", resolve));
    server.kill(); await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 3000))]);
  }
  for (const suffix of ["", "-shm", "-wal"]) {
    for (let attempt = 0; ; attempt++) {
      try { await rm(databasePath + suffix, { force: true }); break; }
      catch (error) { if (error.code !== "EBUSY" || attempt >= 10) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
    }
  }
}
console.log(`HTTP smoke passed: ${checks} requests; auth, profile, portions, history, dashboard, favorites, isolation and JWT revocation. Temporary database removed.`);
