import { addScenario, isUser, listAutomations, UserError } from "@/lib/data";
import { tokenError } from "@/lib/token";

export const dynamic = "force-dynamic";

/** Le script canary:analyze vérifie ici que l'automatisation existe. */
export async function GET(request: Request) {
  const denied = tokenError(request);
  if (denied) return denied;
  const automations = await listAutomations();
  return Response.json({ automations: automations.map((a) => ({ slug: a.slug, title: a.title, version: a.version, owner: a.owner })) });
}

/**
 * Reçoit un scénario validé par une personne dans son terminal.
 * Corps : { automation: "<slug>", added_by?: "bob", title, origin, ticket, expected, evidence? }
 */
export async function POST(request: Request) {
  const denied = tokenError(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Le corps doit être du JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Le corps doit être un objet JSON." }, { status: 400 });
  // Accept CANARY Local's envelope as well as the existing flat server format.
  const canary = typeof body.automation_id === "string";
  const slug = typeof body.automation === "string" ? body.automation : canary ? body.automation_id as string : "";
  if (!slug) return Response.json({ error: "« automation » (le slug de l'automatisation) est obligatoire." }, { status: 400 });
  const author = typeof body.author === "string" ? body.author.toLowerCase() : body.added_by;
  const addedBy = typeof author === "string" && isUser(author) ? author : "bob";

  try {
    const scenario = await addScenario(slug, canary ? body.scenario : body, addedBy);
    const url = new URL(`/a/${slug}#scenarios`, request.url).toString();
    return Response.json({ id: canary ? String(scenario.id) : scenario.id, automation: slug, title: scenario.title, url }, { status: 201 });
  } catch (e) {
    if (e instanceof UserError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
