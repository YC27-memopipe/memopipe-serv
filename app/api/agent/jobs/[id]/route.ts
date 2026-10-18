import { completeJob } from "@/lib/data";
import { tokenError } from "@/lib/token";

export const dynamic = "force-dynamic";

/** L'agent local renvoie le résultat d'une action : { ok: true, result } ou { ok: false, error }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = tokenError(request);
  if (denied) return denied;
  const id = Number((await params).id);
  const body = await request.json().catch(() => null);
  if (!Number.isInteger(id) || !body || typeof body.ok !== "boolean") {
    return Response.json({ error: "Corps attendu : { ok: true, result } ou { ok: false, error }." }, { status: 400 });
  }
  const saved = await completeJob(id, body.ok ? { ok: true, result: body.result } : { ok: false, error: String(body.error ?? "erreur") });
  if (!saved) return Response.json({ error: "Action inconnue, déjà traitée ou expirée." }, { status: 409 });
  return Response.json({ ok: true });
}
