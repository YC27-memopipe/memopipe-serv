import { isUser, UserError } from "@/lib/data";
import { receiveDiscovery } from "@/lib/discoveries";
import { tokenError } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.MEMOPIPE_TEAM_TOKEN?.trim()) return Response.json({ error: "Configurez MEMOPIPE_TEAM_TOKEN pour les analyses d’historique." }, { status: 503 });
  const denied = tokenError(request);
  if (denied) return denied;
  if (Number(request.headers.get("content-length")) > 1000000) return Response.json({ error: "Rapport trop volumineux." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 1000000) return Response.json({ error: "Rapport trop volumineux." }, { status: 413 });
    const body = JSON.parse(raw);
    const author = typeof body?.author === "string" ? body.author.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    if (!isUser(author)) throw new UserError("Auteur inconnu.");
    const d = await receiveDiscovery(author, body.report);
    return Response.json({ id: d.id }, { status: 201 });
  } catch (e) {
    if (e instanceof UserError || e instanceof SyntaxError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
