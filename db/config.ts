type DatabaseEnvironment = {
  [key: string]: string | undefined;
  DATABASE_URL?: string; TURSO_DATABASE_URL?: string; TURSO_AUTH_TOKEN?: string; VERCEL?: string;
};

export function databaseConfiguration(env: DatabaseEnvironment = process.env) {
  const url = env.TURSO_DATABASE_URL || env.DATABASE_URL;
  // Vercel's filesystem cannot persist account data between requests/deployments.
  if (env.VERCEL && (!url || !url.startsWith("libsql://"))) {
    throw new Error("Configure a remote TURSO_DATABASE_URL before deploying to Vercel.");
  }
  if (url?.startsWith("libsql://") && !env.TURSO_AUTH_TOKEN) {
    throw new Error("TURSO_AUTH_TOKEN is required for the remote database.");
  }
  return { url: url ?? "file:./caltrack.db", ...(url?.startsWith("libsql://") ? { authToken: env.TURSO_AUTH_TOKEN } : {}) };
}
