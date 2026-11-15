import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

// Run against the disposable verification server, never against a real account.
const origin = process.env.CALTRACK_TEST_ORIGIN ?? 'http://127.0.0.1:32187';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname), 'Use a local verification server');
const browserServer = await chromium.launchServer({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const browser = await chromium.connect(browserServer.wsEndpoint());
const output = '.taste-skill/adventure-flows';
await mkdir(output, { recursive: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(30000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(origin + '/?demo=1');
  await page.locator('.demo-access-strip').waitFor();
  await page.goto(origin + '/quests');
  assert.equal((await page.request.post(origin + '/api/adventure', { headers: { Origin: origin }, data: { action: 'claim', questId: 'daily-login' } })).status(), 401);
  await page.locator('.daily-login').getByRole('link', { name: 'Masuk & ambil' }).waitFor();
  assert.equal(await page.locator('.daily-login').getByRole('link', { name: 'Masuk & ambil' }).getAttribute('href'), '/login');
  await page.getByRole('button', { name: 'Ambil XP', exact: true }).first().waitFor();
  console.log('Checking demo achievements.');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Ambil XP', exact: true }).first().click();
    await page.locator('.achievement-toast').waitFor();
    console.log(`Demo claim ${i + 1} confirmed.`);
    if (i === 2) {
      await page.getByRole('heading', { name: 'Naik ke level 2!', exact: true }).waitFor();
      assert.match(await page.locator('.achievement-unlocks').innerText(), /Jubah orbit/);
      const frame = await page.locator('.achievement-toast').boundingBox();
      const navigation = await page.getByRole('navigation', { name: 'Navigasi cepat' }).boundingBox();
      assert(frame && navigation && frame.y + frame.height <= navigation.y && frame.x >= 0 && frame.x + frame.width <= 390, `Celebration stays above mobile navigation: ${JSON.stringify({frame,navigation})}`);
      assert.equal(await page.locator('.achievement-toast').evaluate(el => getComputedStyle(el).animationName), 'achievement-arrive');
      await page.locator('.achievement-toast').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      await page.screenshot({ path: output + '/level-mobile.png' });
    }
    await page.getByRole('button', { name: 'Tutup pemberitahuan pencapaian' }).click();
  }
  console.log('Checking avatar previews, visible accessories and demo equipment.');
  const portrait = page.locator('.avatar-portrait');
  await page.getByRole('button', { name: 'Lihat Pemandu aurora', exact: true }).click();
  assert.equal(await portrait.locator('[data-accessory="hat"]').count(), 1);
  assert.equal(await portrait.locator('[data-accessory="lantern"]').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Belum terbuka', exact: true }).isDisabled(), true);
  await portrait.screenshot({ path: output + '/avatar-aurora.png' });
  await page.getByRole('button', { name: 'Lihat Jubah orbit', exact: true }).click();
  assert.equal(await portrait.locator('[data-accessory="moon-brooch"]').count(), 1);
  assert.equal(await portrait.locator('[data-accessory="cloak"]').count(), 1);
  await page.getByRole('button', { name: 'Jeda gerak', exact: true }).click();
  assert.equal(await portrait.locator('.avatar-breath').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.getByRole('button', { name: 'Aktifkan gerak', exact: true }).click();
  assert.equal(await portrait.locator('.avatar-breath').evaluate(el => getComputedStyle(el).animationName), 'avatar-breathe');
  await page.getByRole('button', { name: 'Pakai penampilan', exact: true }).click();
  await page.getByRole('heading', { name: 'Penampilan baru dipakai', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Tutup pemberitahuan pencapaian' }).click();
  await page.getByRole('navigation', { name: 'Navigasi cepat' }).getByRole('link', { name: 'Profil', exact: true }).click();
  await page.locator('.avatar-profile [data-outfit="orbit-cloak"]').waitFor();
  await page.screenshot({ path: output + '/avatar-profile-mobile.png', fullPage: true });
  await page.getByRole('navigation', { name: 'Navigasi cepat' }).getByRole('link', { name: 'Markas', exact: true }).click();
  await page.locator('.night-explorer [data-outfit="orbit-cloak"]').waitFor();
  await page.screenshot({ path: output + '/avatar-home-mobile.png' });
  await page.getByRole('navigation', { name: 'Navigasi cepat' }).getByRole('link', { name: 'Quest', exact: true }).click();
  await portrait.locator('[data-outfit="orbit-cloak"]').waitFor();
  const optional = page.locator('.optional-quests');
  await optional.getByRole('button', { name: 'Pilih quest', exact: true }).first().click();
  await optional.getByRole('button', { name: 'Pilih quest', exact: true }).first().click();
  assert.equal(await optional.getByRole('button', { name: 'Slot terisi' }).count(), 2);
  assert.equal(await optional.getByRole('button', { name: 'Slot terisi' }).first().isDisabled(), true);
  await page.screenshot({ path: output + '/optional-mobile.png', fullPage: true });
  console.log('Checking server selection limits and persisted claims.');

  const registered = await page.request.post(origin + '/api/auth/sign-up/email', { headers: { Origin: origin }, data: { name: 'Quest Test', email: `adventure-${Date.now()}@example.test`, password: randomBytes(24).toString('base64url') } });
  assert.equal(registered.status(), 200);
  const read = async () => (await page.request.get(origin + '/api/adventure')).json();
  const act = data => page.request.post(origin + '/api/adventure', { headers: { Origin: origin }, data });
  let state = await read(); assert.equal(state.totalXp, 0); assert.equal(state.optionalSlotsRemaining, 2);
  assert.equal((await act({ action: 'claim', questId: state.optionalQuests[0].id, xp: 9999 })).status(), 409);
  const chosen = await Promise.all(state.optionalQuests.slice(0, 3).map(quest => act({ action: 'accept', questId: quest.id, slot: 999 })));
  assert.equal(chosen.filter(result => result.status() === 200).length, 2);
  assert.equal(chosen.filter(result => result.status() === 409).length, 1);
  state = await read(); assert.equal(state.optionalSlotsRemaining, 0); assert.equal(state.optionalQuests.filter(q => q.accepted).length, 2);
  for (const [index, inputMethod] of ['text','search','photo','voice','recipe'].entries()) {
    const saved = await page.request.post(origin + '/api/food-logs', { headers: { Origin: origin }, data: { mealType: ['breakfast','lunch','dinner'][index % 3], inputMethod, notes: 'Catatan porsi uji', items: [{ foodName: `Bahan ${index}`, weightGrams: 100, calories: 100, proteinG: 5, carbsG: 10, fatG: 4, fiberG: 1, sugarG: 1, sodiumMg: 10 }] } });
    assert.equal(saved.status(), 201, await saved.text());
  }
  const selected = state.optionalQuests.find(q => q.accepted);
  assert.equal((await act({ action: 'claim', questId: selected.id, xp: 9999 })).status(), 200);
  assert.equal((await act({ action: 'claim', questId: selected.id })).status(), 200);
  state = await read(); assert.equal(state.totalXp, selected.xp);
  await page.goto(origin + '/quests'); await optional.waitFor();
  assert.equal(await page.locator('.achievement-toast').count(), 0, 'History load does not replay a celebration');
  assert.equal(await optional.getByRole('button', { name: 'Slot terisi' }).count(), 2);

  // A slow read must never overwrite a newer successful mutation.
  const oldState = structuredClone(state);
  console.log('Checking stale reads and reduced motion.');
  await page.route('**/api/adventure', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    await new Promise(resolve => setTimeout(resolve, 1400));
    await route.fulfill({ json: oldState }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Perbarui', exact: true }).click();
  await page.locator('.quest-board > .quest-list').getByRole('button', { name: 'Ambil XP', exact: true }).first().click();
  await page.locator('.achievement-toast').waitFor();
  await new Promise(resolve => setTimeout(resolve, 1600));
  assert.match(await page.locator('.avatar-stage').innerText(), new RegExp(`${selected.xp + 20} XP terkumpul`));
  await page.unroute('**/api/adventure');
  await page.getByRole('button', { name: 'Tutup pemberitahuan pencapaian' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.quest-board > .quest-list').getByRole('button', { name: 'Ambil XP', exact: true }).first().click();
  await page.locator('.achievement-toast').waitFor();
  assert.equal(await page.locator('.achievement-toast').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await page.locator('.achievement-emblem').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await portrait.locator('.avatar-breath').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await portrait.locator('.avatar-eyes').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.getByRole('button', { name: 'Tutup pemberitahuan pencapaian' }).click();
  await page.reload(); await optional.waitFor();
  assert.equal(await page.locator('.achievement-toast').count(), 0);
  await page.locator('.quest-board > .quest-list').getByRole('button', { name: 'Ambil XP', exact: true }).first().click();
  await page.locator('.achievement-toast').waitFor();
  await page.getByRole('button', { name: 'Tutup pemberitahuan pencapaian' }).click();
  await page.getByRole('button', { name: 'Lihat Jubah orbit', exact: true }).click();
  await page.getByRole('button', { name: 'Pakai penampilan', exact: true }).click();
  await page.getByRole('heading', { name: 'Penampilan baru dipakai', exact: true }).waitFor();
  assert.equal((await read()).equippedReward, 'orbit-cloak');
  await page.reload(); await portrait.locator('[data-outfit="orbit-cloak"]').waitFor();
  assert.equal(await page.locator('.achievement-toast').count(), 0);
  console.log('Checking daily login UI, duplicate claims and concurrent claims from a new account.');
  const beforeLogin = await read();
  await page.getByRole('button', { name: 'Ambil hadiah login', exact: true }).click();
  await page.getByRole('button', { name: 'Sudah diambil', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Sudah diambil', exact: true }).isDisabled(), true);
  assert.equal((await read()).totalXp, beforeLogin.totalXp + 10);
  assert.match(await page.locator('.daily-login').innerText(), /00.00 WIB/);
  await page.reload();
  await page.getByRole('button', { name: 'Sudah diambil', exact: true }).waitFor();
  assert.equal(await page.locator('.achievement-toast').count(), 0);
  assert.equal((await act({ action: 'claim', questId: 'daily-login', xp: 99999, day: '2099-01-01', userId: 'someone-else' })).status(), 200);
  assert.equal((await read()).totalXp, beforeLogin.totalXp + 10);
  const freshAccount = await browser.newContext();
  try {
    const response = await freshAccount.request.post(origin + '/api/auth/sign-up/email', { headers: { Origin: origin }, data: { name: 'Daily Test', email: `daily-${Date.now()}@example.test`, password: randomBytes(24).toString('base64url') } });
    assert.equal(response.status(), 200);
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => freshAccount.request.post(origin + '/api/adventure', { headers: { Origin: origin }, data: { action: 'claim', questId: 'daily-login', xp: 9999, day: '2099-01-01' } })));
    assert(concurrent.every(response => response.status() === 200));
    const freshState = await (await freshAccount.request.get(origin + '/api/adventure')).json();
    assert.equal(freshState.totalXp, 10); assert.equal(freshState.dailyLogin.claimed, true);
    assert.equal(freshState.quests[0].progress, 0);
    assert.equal((await read()).totalXp, beforeLogin.totalXp + 10, 'Login rewards stay account scoped');
  } finally { await freshAccount.close(); }
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}`);
    await page.screenshot({ path: `${output}/account-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  await writeFile(output + '/result.json', JSON.stringify({ passed: true, checks: ['daily login account UI and demo login link', 'anonymous login claim rejected', 'daily login persists after reload', 'concurrent daily login grants only 10 server XP', 'XP and level animation', 'reward unlock', 'locked outfit preview', 'visible clothing and accessories', 'motion pause', 'shared profile and home avatar', 'persisted avatar equipment', 'two optional slots', 'concurrent acceptance cap', 'idempotent claim', 'persisted selection', 'stale read protection', 'reduced motion', 'no replay on reload', 'desktop/tablet/mobile bounds'] }, null, 2));
  console.log('Passed: adventure choices, animation, persistence, concurrency, stale reads and reduced motion.');
} catch (error) { console.error(error); throw error; } finally {
  // Terminate only this disposable browser. Edge can retain its process after a
  // graceful context close on Windows, even after all assertions have passed.
  if (process.platform === 'win32') {
    // Invoke the executable directly: the shell-based taskkill used by
    // Playwright can fail to resolve in restricted Windows environments.
    const killed = spawnSync(`${process.env.SystemRoot ?? 'C:/Windows'}/System32/taskkill.exe`, ['/PID', String(browserServer.process().pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8' });
    if (killed.status !== 0 && browserServer.process().exitCode === null) throw new Error(`Cannot close test browser: ${killed.stderr || killed.error?.message}`);
  } else browserServer.process().kill();
  // The browser is stopped above. Bound upstream websocket cleanup too: the
  // standalone runner must not linger on retained Playwright handles on Windows.
  let cleanupTimer;
  try {
    await Promise.race([
      Promise.all([browser.close(), browserServer.kill()]),
      new Promise(resolve => { cleanupTimer = setTimeout(resolve, 2000); })
    ]);
  } finally { clearTimeout(cleanupTimer); }
}
// Reached only when assertions and browser termination both succeeded. A thrown
// assertion or cleanup failure exits through Node's normal error path instead.
process.exit(0);
