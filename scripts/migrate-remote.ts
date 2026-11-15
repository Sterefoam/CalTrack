import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { databaseConfiguration } from "../db/config";

async function main() {
  const config = databaseConfiguration();
  if (!config.url.startsWith("libsql://")) throw new Error("Remote migration requires a Turso database.");
  const client = createClient(config);
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Remote database migrations completed.");
  } finally { client.close(); }
}
main().catch(() => {
  // Driver errors may contain connection details; do not print them.
  console.error("Remote migration failed. Verify server credentials, network and migration history.");
  process.exitCode = 1;
});
