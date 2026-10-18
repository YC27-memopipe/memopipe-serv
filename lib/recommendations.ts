import { compile } from "./dsl";
import { SYSTEM_IDS, systemLabel } from "./labels";
import type { ScenarioInput } from "./types";

export type CatalogProcedure = { slug: string; title: string; usage: string; owner: string; version: number; versionId: number; dsl: string };
export type Recommendation = {
  slug: string; title: string; owner: string; version: number; versionId: number;
  score: number; reasons: string[]; caseIndexes: number[]; parameters: string[];
};

export function requesterParameters(source: string): string[] {
  const c = compile(source);
  if (!c.ok) return [];
  const names = new Set<string>();
  const aliases = new Set(["ticket.requester"]);
  for (const i of c.program.instructions) if (i.op === "set" && i.expr.k === "path" && i.expr.p.join(".") === "ticket.requester") aliases.add(i.name);
  for (const prefix of aliases) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of source.matchAll(new RegExp(`\\b${escaped}\\.([A-Za-z_]+)`, "g"))) names.add(m[1]);
  }
  return [...names];
}

/** Match the executable published procedure, never another colleague's history.
 * Scores describe structural overlap, not a probability of passing the tests.
 * This first observer recognizes Nimbus access requests only.
 */
export function recommendProcedures(catalog: CatalogProcedure[], cases: ScenarioInput[]): Recommendation[] {
  const matches: Recommendation[] = [];
  for (const item of catalog) {
    const c = compile(item.dsl);
    if (!c.ok) continue;
    const actions = c.program.instructions.filter(i => i.op === "do");
    const grants = actions.filter(i => i.action === "iam.grant");
    // Mail-only and unrelated procedures must not match just because their title says "accès".
    if (!grants.length || actions.some(i => i.action.startsWith("gmail."))) continue;
    const systems = new Set(grants.flatMap(i => {
      const a = i.args.system;
      return a?.kind === "template" && !a.value.includes("{{") ? [a.value] : [];
    }));
    if (!systems.size) continue;
    const indexes = cases.flatMap((s, i) => s.ticket.type === "access_request" && SYSTEM_IDS.some(k => systems.has(k) && s.expected[k] !== undefined) ? [i] : []);
    if (!indexes.length) continue;
    const shared = SYSTEM_IDS.filter(k => systems.has(k) && indexes.some(i => cases[i].expected[k] !== undefined));
    const closes = actions.some(i => i.action === "tickets.close");
    const score = Math.round(60 + 30 * shared.length / SYSTEM_IDS.length + (closes ? 10 : 0));
    matches.push({
      slug: item.slug, title: item.title, owner: item.owner, version: item.version, versionId: item.versionId, score,
      caseIndexes: indexes, parameters: requesterParameters(item.dsl),
      reasons: [
        `${indexes.length} demande${indexes.length > 1 ? "s" : ""} d’accès retrouvée${indexes.length > 1 ? "s" : ""} dans votre historique.`,
        `La procédure publiée agit sur les mêmes permissions : ${shared.map(systemLabel).join(", ")}.`,
        ...(closes ? ["Elle couvre l’attribution des accès et la clôture du ticket."] : []),
        "Les niveaux d’accès peuvent différer : le test déterminera la compatibilité.",
      ],
    });
  }
  return matches.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
}
