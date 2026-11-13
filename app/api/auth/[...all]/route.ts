import { AuthConfigurationError, getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  try {
    const auth = getAuth();
    if (new URL(request.url).pathname === "/api/auth/request-password-reset" && !auth.options.emailAndPassword?.sendResetPassword) {
      return Response.json({ error: "password_reset_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  catch (error) { return Response.json({ error: error instanceof AuthConfigurationError ? "auth_not_configured" : "auth_unavailable" }, { status: 503 }); }
}

export { handler as GET, handler as POST };
