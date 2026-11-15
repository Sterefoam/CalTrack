import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { databaseConfiguration } from "./config";

const globalForDatabase = globalThis as typeof globalThis & {
  caltrackDbClient?: ReturnType<typeof createClient>;
};

const client = globalForDatabase.caltrackDbClient ?? createClient(databaseConfiguration());

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.caltrackDbClient = client;
}

export const db = drizzle(client, { schema });
