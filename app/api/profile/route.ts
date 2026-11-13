import { requireUser } from "@/lib/auth/request";
import { InputError, readJson } from "@/lib/http/json";
import { validateProfile } from "@/lib/nutrition/profile";
import { deleteProfile, getProfile, saveProfile } from "@/lib/profile/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  try { return Response.json(await getProfile(identity.userId), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "profile_unavailable" }, { status: 500 }); }
}
export async function PUT(request: Request) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  try {
    const profile = validateProfile(await readJson(request, 8000));
    if (!profile) return Response.json({ error: "invalid_profile", message: "Periksa nama, usia dewasa, ukuran tubuh, aktivitas, dan tujuan." }, { status: 400 });
    return Response.json(await saveProfile(identity.userId, profile), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof InputError ? error.code : "profile_unavailable" }, { status: error instanceof InputError ? error.status : 500 });
  }
}
export async function DELETE(request: Request) {
  const identity = await requireUser(request);
  if (identity instanceof Response) return identity;
  try {
    await deleteProfile(identity.userId);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "profile_unavailable" }, { status: 500 }); }
}
