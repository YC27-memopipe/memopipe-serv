import { reset } from "@/lib/data";
import { tokenError } from "@/lib/token";

export const dynamic = "force-dynamic";

/** Corps facultatif : { "scope": "demo" } (tickets et accès) ou { "scope": "all" } (tout, avec la v1 d'Alice). */
export async function POST(request: Request) {
  const denied = tokenError(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const scope = body?.scope === "all" ? "all" : "demo";
  await reset(scope);
  return Response.json({ ok: true, scope });
}
