import { defineConfig } from "drizzle-kit";
import { databaseConfiguration } from "./db/config";

export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: databaseConfiguration(),
  strict: true,
  verbose: true
});
