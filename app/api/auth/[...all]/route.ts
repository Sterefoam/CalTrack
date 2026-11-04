import { AuthConfigurationError, getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  try { return await getAuth().handler(request); }
  catch (error) { return Response.json({ error: error instanceof AuthConfigurationError ? "auth_not_configured" : "auth_unavailable" }, { status: 503 }); }
}

export { handler as GET, handler as POST };
