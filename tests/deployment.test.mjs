import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("database bootstrap refuses preview and ordinary local builds before touching the database", () => {
  for (const environment of ["preview", "development", ""]) {
    const result = spawnSync(process.execPath, ["scripts/vercel-build.mjs"], {
      env: { ...process.env, CALTRACK_MIGRATE: "1", VERCEL_ENV: environment }, encoding: "utf8", windowsHide: true,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /restricted to an explicit production deployment/);
  }
});
