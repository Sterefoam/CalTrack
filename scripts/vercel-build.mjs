import { spawnSync } from "node:child_process";

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

// Opt-in for a deliberate production bootstrap only, never a preview build.
if (process.env.CALTRACK_MIGRATE === "1") {
  if (process.env.VERCEL_ENV !== "production") {
    console.error("Database bootstrap is restricted to an explicit production deployment.");
    process.exit(1);
  }
  run(["node_modules/tsx/dist/cli.mjs", "scripts/migrate-remote.ts"]);
}
run(["node_modules/next/dist/bin/next", "build"]);
