import { q, q1 } from "./db";
import { addScenario, demoStartedAt, finishRun, getAutomation, isUser, listAutomations, parseScenario, startRun, UserError } from "./data";
import { recommendProcedures, type CatalogProcedure, type Recommendation } from "./recommendations";
import type { ScenarioInput } from "./types";
import { SYSTEM_IDS } from "./labels";

export type DiscoveryReport = {
  format: "memopipe-discovery/v1"; provenance: "recorded" | "synthetic-demo";
  start: string; end: string; cases: ScenarioInput[]; warnings: string[];
};
export type Discovery = {
  id: number; author: string; start_time: string; end_time: string; status: "pending" | "done" | "error";
  job_id: number | null; catalog: CatalogProcedure[]; report: DiscoveryReport | null;
  recommendations: Recommendation[] | null; error: string | null; created_at: string | Date;
};

async function catalogSnapshot(): Promise<CatalogProcedure[]> {
  const catalog = await listAutomations();
  const details = await Promise.all(catalog.map(a => getAutomation(a.slug)));
  return details.flatMap(d => d?.current ? [{ slug: d.automation.slug, title: d.automation.title, usage: d.automation.usage, owner: d.automation.owner, version: d.current.number, versionId: d.current.id, dsl: d.current.dsl }] : []);
}

export function parseDiscoveryReport(value: unknown): DiscoveryReport {
  if (!value || typeof value !== "object") throw new UserError("Rapport de découverte manquant.");
  const r = value as DiscoveryReport;
  const span = Date.parse(r.end) - Date.parse(r.start);
  if (r.format !== "memopipe-discovery/v1" || !["recorded", "synthetic-demo"].includes(r.provenance) || !Number.isFinite(span) || span <= 0 || span > 365 * 86400000) throw new UserError("Format, provenance ou période de découverte invalide.");
  if (!Array.isArray(r.cases) || r.cases.length > 100 || !Array.isArray(r.warnings) || r.warnings.length > 200) throw new UserError("Le rapport dépasse le nombre de cas autorisé.");
  const cases = r.cases.map(c => {
    const s = parseScenario(c);
    if (s.ticket.type !== "access_request" || SYSTEM_IDS.some(k => s.expected[k] === undefined) || !s.expected.ticket_status) throw new UserError("Chaque cas Nimbus doit préciser les trois permissions et le statut attendu.");
    const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
    if ((s.ticket.requester.end_date && !validDate(s.ticket.requester.end_date)) || (s.expected.expires_before && !validDate(s.expected.expires_before))) throw new UserError("Date invalide dans le cas observé.");
    if (!s.evidence?.length || s.evidence.length > 100 || s.evidence.some(e => !Number.isSafeInteger(e.frame_id) || e.frame_id! < 0 || !e.quote.trim() || e.quote.length > 1000)) throw new UserError("Chaque cas Nimbus doit contenir des citations et des identifiants de frames valides.");
    return s;
  });
  return { format: r.format, provenance: r.provenance, start: r.start, end: r.end, cases, warnings: r.warnings.map(w => String(w).slice(0, 1000)) };
}

/** Explicit web consent creates a bounded job; the hub never opens localhost itself. */
export async function requestDiscovery(author: string, since: string, consent: boolean) {
  if (!isUser(author) || !consent) throw new UserError("Votre consentement explicite est nécessaire avant toute lecture.");
  const durations: Record<string, number> = { "30m": 30 * 60000, "24h": 86400000, "2d": 2 * 86400000 };
  if (!Object.hasOwn(durations, since)) throw new UserError("Période invalide.");
  // The same token is used by the PC agent. Discovery must not be exposed on an unprotected hub.
  if (!process.env.MEMOPIPE_TEAM_TOKEN?.trim()) throw new UserError("Configurez MEMOPIPE_TEAM_TOKEN sur le hub et CANARY_TEAM_TOKEN dans l’agent local.");
  const catalog = await catalogSnapshot();
  const rehearsalStart = await demoStartedAt();
  const now = Date.now();
  const end = new Date(now).toISOString();
  const start = new Date(Math.max(now - durations[since], rehearsalStart ? Date.parse(rehearsalStart) : 0)).toISOString();
  const names = { alice: "Alice", bob: "Bob", chloe: "Chloé" };
  const job = (await q1<{ id: number }>("insert into agent_jobs (action, args) values ('screenpipe.discover', $1::jsonb) returning id", [JSON.stringify({ consent: true, start, end, author: names[author] })]))!;
  return (await q1<Discovery>("insert into discoveries (author, start_time, end_time, job_id, catalog) values ($1, $2, $3, $4, $5::jsonb) returning *", [author, start, end, job.id, JSON.stringify(catalog)]))!;
}

/** CLI report: consent was obtained locally; behavior validation still happens in the hub. */
export async function receiveDiscovery(author: string, value: unknown) {
  if (!isUser(author)) throw new UserError("Auteur inconnu.");
  const report = parseDiscoveryReport(value);
  const catalog = await catalogSnapshot();
  const recommendations = recommendProcedures(catalog, report.cases);
  return (await q1<Discovery>("insert into discoveries (author, start_time, end_time, status, catalog, report, recommendations) values ($1, $2, $3, 'done', $4::jsonb, $5::jsonb, $6::jsonb) returning *", [author, report.start, report.end, JSON.stringify(catalog), JSON.stringify(report), JSON.stringify(recommendations)]))!;
}

export async function getDiscovery(id: number, author: string) {
  let d = await q1<Discovery>("select * from discoveries where id = $1 and author = $2", [id, author]);
  if (!d || d.status !== "pending") return d;
  const job = await q1<{ status: string; result: unknown; error: string | null }>("select * from agent_jobs where id = $1", [d.job_id]);
  if (job?.status === "done") {
    try {
      const report = parseDiscoveryReport(job.result);
      if (report.provenance !== "recorded" || report.start !== d.start_time || report.end !== d.end_time) throw new UserError("Le rapport ne correspond pas à la période Screenpipe autorisée.");
      const recommendations = recommendProcedures(d.catalog, report.cases);
      await q("update discoveries set status = 'done', report = $2::jsonb, recommendations = $3::jsonb where id = $1 and status = 'pending'", [id, JSON.stringify(report), JSON.stringify(recommendations)]);
    } catch (e) {
      await q("update discoveries set status = 'error', error = $2 where id = $1", [id, e instanceof Error ? e.message : "Rapport invalide"]);
    }
  } else if (!job || ["error", "expired"].includes(job.status) || Date.now() - new Date(d.created_at).getTime() > 300000) {
    await q("update agent_jobs set status = 'expired' where id = $1 and status in ('pending', 'claimed')", [d.job_id]);
    await q("update discoveries set status = 'error', error = $2 where id = $1", [id, job?.error ?? "L’agent local n’a pas terminé l’analyse. Lancez bun run canary:agent puis recommencez sur une période plus courte."]);
  }
  d = await q1<Discovery>("select * from discoveries where id = $1 and author = $2", [id, author]);
  return d;
}

export async function recentDiscoveries(author: string) {
  await listAutomations();
  return q<Discovery>("select * from discoveries where author = $1 order by id desc limit 12", [author]);
}

/** A suggested case is never a reference until its owner explicitly accepts it. */
export async function acceptRecommendation(id: number, slug: string, caseIndex: number, author: string, confirmed: boolean) {
  if (!confirmed) throw new UserError("Confirmez que le comportement observé est une bonne référence.");
  const d = await getDiscovery(id, author);
  const recommendation = d?.recommendations?.find(r => r.slug === slug);
  if (d?.status !== "done" || !recommendation || !Number.isInteger(caseIndex) || !recommendation.caseIndexes.includes(caseIndex)) throw new UserError("Recommandation introuvable.");
  const a = await getAutomation(slug);
  if (!a?.current || a.current.id !== recommendation.versionId) throw new UserError("La procédure a changé depuis l’analyse. Relancez la découverte pour tester la nouvelle version.");
  const selected = await q1<{ run_id: number | null }>("select run_id from discovery_selections where discovery_id = $1 and automation_id = $2 and case_index = $3", [id, a.automation.id, caseIndex]);
  if (selected?.run_id) return selected.run_id;
  const claim = await q1("insert into discovery_selections (discovery_id, automation_id, case_index) values ($1, $2, $3) on conflict do nothing returning *", [id, a.automation.id, caseIndex]);
  if (!claim) throw new UserError("Ce test est déjà en cours de préparation.");
  try {
    const scenario = await addScenario(slug, d.report!.cases[caseIndex], author);
    const run = await startRun({ automationId: a.automation.id, scenarioId: scenario.id, dsl: a.current.dsl, source: `v${a.current.number}`, user: author });
    await q("update discovery_selections set scenario_id = $4, run_id = $5 where discovery_id = $1 and automation_id = $2 and case_index = $3", [id, a.automation.id, caseIndex, scenario.id, run.id]);
    // Still a real, isolated Nimbus test. It can subsequently be inspected step by step.
    await finishRun(run.id);
    return run.id;
  } catch (e) {
    await q("delete from discovery_selections where discovery_id = $1 and automation_id = $2 and case_index = $3 and run_id is null", [id, a.automation.id, caseIndex]);
    throw e;
  }
}
