// Uses a production build, real browser uploads and real local OCR; no response mocks.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const databasePath = join(root, ".caltrack", `smoke-${randomUUID()}.db`);
const origin = "http://127.0.0.1:3106";
const directory = join(root, ".caltrack", "ocr");
const results = { realOcr: true, mockedResponses: false, providerConfigured: false, languages: [], consoleErrors: [], screenshots: [] };
let server, browser, page;
try {
  await mkdir(directory, { recursive: true });
  const prepared = spawn(process.execPath, [join(root, "scripts/smoke-backend.mjs"), "--prepare", databasePath], { cwd: root, windowsHide: true, stdio: "ignore" });
  assert.equal(await new Promise((resolve, reject) => { prepared.once("error", reject); prepared.once("exit", resolve); }), 0);
  server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3106"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DATABASE_URL: `file:${databasePath}`, BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"), OPENAI_API_KEY: "", RESEND_API_KEY: "", AUTH_EMAIL_FROM: "", NODE_ENV: "production" },
  });
  server.stdout.resume(); server.stderr.resume();
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("OCR test server exited");
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Server did not start");
  const anonymous = await fetch(`${origin}/api/analyze/label`, { method: "POST" });
  assert.equal(anonymous.status, 401);
  browser = await chromium.launch({ channel: process.env.OCR_BROWSER_CHANNEL || "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
  page.on("pageerror", error => results.consoleErrors.push(error.message));
  await page.goto(origin);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  assert.ok((await page.locator("body").innerText()).length > 100);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.goto(`${origin}/register`);
  const password = randomBytes(24).toString("base64url");
  await page.locator("#auth-name").fill("OCR Acceptance");
  await page.locator("#auth-email").fill(`ocr-${randomUUID()}@example.test`);
  await page.locator("#auth-password").fill(password);
  await page.locator("#auth-confirmation").fill(password);
  await page.getByRole("button", { name: "Daftar", exact: true }).click();
  await page.waitForURL("**/onboarding");
  await page.goto(`${origin}/log/label`);
  await page.locator("#label-language").waitFor();
  const bytes = await readFile(join(directory, "fixtures/eng-clear.jpg"));
  const invalid = await context.request.post(`${origin}/api/analyze/label`, { multipart: { language: "../../eng", photo: { name: "label.jpg", mimeType: "image/jpeg", buffer: bytes } } });
  assert.equal(invalid.status(), 400); assert.equal((await invalid.json()).error, "invalid_label_language");
  for (const language of ["eng", "spa", "jpn", "chi_sim"]) {
    await page.locator("#label-language").selectOption(language);
    await page.locator("#label-file").setInputFiles(join(directory, `fixtures/${language}-clear.jpg`));
    const response = page.waitForResponse(response => response.url() === `${origin}/api/analyze/label` && response.request().method() === "POST", { timeout: 35000 });
    await page.getByRole("button", { name: "Baca label", exact: true }).click();
    const analyzed = await response;
    assert.equal(analyzed.status(), 200, `Actual ${language} photo OCR`);
    await page.getByRole("heading", { name: "Periksa hasil label" }).waitFor();
    const expected = { calories: "240", proteinG: "5.5", carbsG: "30", fatG: "9", fiberG: "2", sugarG: "0", sodiumMg: "120" };
    for (const [key, value] of Object.entries(expected)) assert.equal(await page.locator(`#label-${key}`).inputValue(), value, `${language}:${key}`);
    assert.equal(await page.locator("#label-basis").inputValue(), "100");
    results.languages.push({ language, actualEndpoint: 200, allSevenNutrientsAndBasisMatched: true });
    console.log(JSON.stringify({ language, actualOcrPassed: true }));
  }
  for (const [width, name] of [[390, "mobile"], [1440, "desktop"]]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    const screenshot = join(directory, `browser-${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.screenshots.push(`.caltrack/ocr/browser-${name}.png`);
  }
  await page.locator("#label-name").fill("OCR Chinese acceptance");
  await page.locator("#label-consumed").fill("50");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Hitung porsi dan tinjau" }).click();
  await page.waitForURL("**/log/review");
  assert.equal(await page.locator("input[id$='-calories']").inputValue(), "120");
  assert.equal(await page.locator("input[id$='-grams']").inputValue(), "50");
  assert.equal(await page.locator("input[id$='-proteinG']").inputValue(), "2.75");
  const invalidInputs = await page.locator("form input").evaluateAll(inputs => inputs.filter(input => !input.validity.valid).map(input => ({ id: input.id, reason: input.validationMessage })));
  assert.deepEqual(invalidInputs, [], "Fractional label nutrients must remain valid in the review form");
  const saving = page.waitForResponse(response => response.url() === `${origin}/api/food-logs` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Simpan ke akun", exact: true }).click();
  const saved = await saving;
  assert.equal(saved.status(), 201);
  const snapshot = await saved.json();
  assert.equal(snapshot.items[0].calories, 120); assert.equal(snapshot.items[0].weightGrams, 50);
  assert.equal(snapshot.items[0].sodiumMg, 60);
  results.portionAndSave = { consumedGrams: 50, calories: 120, sodiumMg: 60, status: 201 };
  assert.deepEqual(results.consoleErrors, []);
  await writeFile(join(directory, "browser-evaluation.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(directory, "browser-failure.png"), fullPage: true }).catch(() => {});
    await writeFile(join(directory, "browser-failure.txt"), await page.locator("body").innerText()).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    const exited = new Promise(resolve => server.once("exit", resolve)); server.kill();
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
  }
  for (const suffix of ["", "-shm", "-wal"]) {
    for (let i = 0; ; i++) {
      try { await rm(databasePath + suffix, { force: true }); break; }
      catch (error) { if (error.code !== "EBUSY" || i >= 10) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
    }
  }
}
