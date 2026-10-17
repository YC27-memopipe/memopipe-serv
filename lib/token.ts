// Jeton d'équipe partagé, exigé par les routes HTTP quand MEMOPIPE_TEAM_TOKEN est défini.
export function tokenError(request: Request): Response | null {
  const expected = process.env.MEMOPIPE_TEAM_TOKEN;
  if (!expected) return null;
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (got === expected) return null;
  return Response.json({ error: "Jeton d'équipe manquant ou invalide (Authorization: Bearer <MEMOPIPE_TEAM_TOKEN>)." }, { status: 401 });
}
