// Toutes les opérations du hub et de l'app de démo. Aucune dépendance à Next.js : testable avec bun.
import { q, q1 } from "./db";
import { compile, type DslError, type Program } from "./dsl";
import { isLevel, SYSTEM_IDS } from "./labels";
import { compare, runToEnd, start, step } from "./runner";
import { TABLES } from "./schema";
import { ALICE_AUTOMATION, ALICE_SCENARIO, DEMO_TICKETS } from "./seed";
import type { Actions, CompareRow, Evidence, Expected, Grant, Requester, RunState, ScenarioInput, Ticket } from "./types";

export const USERS = { alice: "Alice", bob: "Bob", chloe: "Chloé" } as const;
export type UserId = keyof typeof USERS;
export const isUser = (id: string): id is UserId => Object.prototype.hasOwnProperty.call(USERS, id);
export const userName = (id: string | null | undefined) => (id && isUser(id) ? USERS[id] : id ?? "");

/** Erreur dont le message peut être montré tel quel. */
export class UserError extends Error {}

export type AutomationRow = {
  id: number; slug: string; title: string; usage: string; owner: string; current_version: number | null; created_at: Date | string;
};
export type VersionRow = {
  id: number; automation_id: number; number: number; dsl: string; author: string; note: string; approved_by: string | null; created_at: Date | string;
};
export type ScenarioRow = {
  id: number; automation_id: number; title: string; origin: string; ticket: ScenarioInput["ticket"]; expected: Expected;
  evidence: Evidence[]; added_by: string; created_at: Date | string;
};
export type TestOutcome = { runId: number; passed: boolean; failures: number; error: string | null };
export type TestRow = { scenarioId: number; title: string; origin: string; base: TestOutcome | null; copy: TestOutcome };
export type DraftStatus = "draft" | "proposed" | "approved" | "rejected";
export type DraftRow = {
  id: number; automation_id: number; base_version: number; author: string; dsl: string; reason: string; status: DraftStatus;
  results: TestRow[] | null; decided_by: string | null; decided_at: Date | string | null; proposed_at: Date | string | null;
  published_version: number | null; created_at: Date | string;
};
export type CommentRow = { id: number; draft_id: number; author: string; body: string; created_at: Date | string };
export type RunRow = {
  id: number; automation_id: number; scenario_id: number; source: string; dsl: string; test_ticket: string; test_email: string;
  state: RunState; status: "running" | "done" | "error"; result: CompareRow[] | null; batch: string | null; created_by: string; created_at: Date | string;
};

// ---------- Démarrage et données de départ ----------

const flags = globalThis as unknown as { __memopipeSeed?: Promise<void> };

async function init() {
  flags.__memopipeSeed ??= (async () => {
    const row = await q1<{ n: number }>("select ((select count(*) from automations) + (select count(*) from tickets))::int as n");
    if (!row || Number(row.n) === 0) {
      // Initial seed only: startup must never truncate existing application data.
      for (const ticket of DEMO_TICKETS) await insertTicket(ticket);
      const automation = await insertAutomation(ALICE_AUTOMATION);
      await insertScenario(automation.id, ALICE_SCENARIO, "alice");
    }
  })().catch((e) => {
    flags.__memopipeSeed = undefined;
    throw e;
  });
  return flags.__memopipeSeed;
}

/** « demo » remet les tickets et les accès à zéro ; « all » repart aussi d'un catalogue avec la v1 d'Alice. */
export async function reset(scope: "demo" | "all") {
  if (scope === "all") {
    await q(`truncate ${TABLES.join(", ")} restart identity cascade`);
  } else {
    await q("delete from grants");
    await q("delete from console_saves");
    await q("delete from tickets");
  }
  for (const t of DEMO_TICKETS) await insertTicket(t);
  if (scope === "all") {
    const a = await insertAutomation(ALICE_AUTOMATION);
    await insertScenario(a.id, ALICE_SCENARIO, "alice");
  }
}

// ---------- Utilitaires ----------

export function formatErrors(errors: DslError[]) {
  return errors.map((e) => `Ligne ${e.line} : ${e.message}`).join("\n");
}

function programOf(dsl: string): Program {
  const c = compile(dsl);
  if (!c.ok) throw new UserError(formatErrors(c.errors));
  return c.program;
}

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// ---------- Catalogue ----------

async function insertAutomation(input: { slug: string; title: string; usage: string; owner: string; dsl: string }) {
  const a = (await q1<AutomationRow>(
    "insert into automations (slug, title, usage, owner) values ($1, $2, $3, $4) returning *",
    [input.slug, input.title, input.usage, input.owner],
  ))!;
  const v = (await q1<VersionRow>(
    "insert into versions (automation_id, number, dsl, author, note) values ($1, 1, $2, $3, 'Première version') returning *",
    [a.id, input.dsl, input.owner],
  ))!;
  await q("update automations set current_version = $1 where id = $2", [v.id, a.id]);
  return { ...a, current_version: v.id };
}

export async function listAutomations() {
  await init();
  return q<AutomationRow & { version: number | null; version_author: string | null; scenarios: number; open: number }>(`
    select a.*, v.number as version, v.author as version_author,
      (select count(*)::int from scenarios s where s.automation_id = a.id) as scenarios,
      (select count(*)::int from drafts d where d.automation_id = a.id and d.status = 'proposed') as open
    from automations a left join versions v on v.id = a.current_version
    order by a.created_at desc, a.id desc`);
}

export async function getAutomation(slug: string) {
  await init();
  const automation = await q1<AutomationRow>("select * from automations where slug = $1", [slug]);
  if (!automation) return null;
  const [versions, scenarios, drafts] = await Promise.all([
    q<VersionRow>("select * from versions where automation_id = $1 order by number desc", [automation.id]),
    q<ScenarioRow>("select * from scenarios where automation_id = $1 order by id", [automation.id]),
    q<DraftRow>("select * from drafts where automation_id = $1 order by id desc", [automation.id]),
  ]);
  const current = versions.find((v) => v.id === automation.current_version) ?? versions[0];
  return { automation, current, versions, scenarios, drafts };
}

export async function publishAutomation(input: { title: string; usage: string; dsl: string }, owner: string) {
  await init();
  const program = programOf(input.dsl);
  const title = input.title.trim() || program.title || "";
  if (!title) throw new UserError("Donne un titre à l'automatisation.");
  const usage = input.usage.trim() || program.usage || "";
  const base = slugify(title) || "automatisation";
  let slug = base;
  for (let n = 2; await q1("select 1 from automations where slug = $1", [slug]); n++) slug = `${base}-${n}`;
  return insertAutomation({ slug, title, usage, owner, dsl: input.dsl });
}

// ---------- Scénarios ----------

const STATUSES = ["open", "approved", "done"];

/** Valide un scénario venant du formulaire ou du script memopipe:analyze. */
export function parseScenario(value: unknown): ScenarioInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UserError("Le scénario doit être un objet JSON.");
  const v = value as Record<string, unknown>;
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (!title) throw new UserError("« title » est obligatoire.");
  const origin = typeof v.origin === "string" && v.origin.trim() ? v.origin.trim() : "Manuel";

  const t = v.ticket as Record<string, unknown> | undefined;
  if (!t || typeof t !== "object") throw new UserError("« ticket » est obligatoire.");
  const r = t.requester as Record<string, unknown> | undefined;
  if (!r || typeof r !== "object") throw new UserError("« ticket.requester » est obligatoire.");
  const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  const requester: Requester = { name: str(r.name), email: str(r.email), contract: str(r.contract).toLowerCase() };
  if (!requester.name || !requester.contract) throw new UserError("Le demandeur doit avoir « name » et « contract ».");
  if (!/^[^@\s]+@[^@\s]+$/.test(requester.email)) throw new UserError("« ticket.requester.email » n'est pas un email valide.");
  if (str(r.team)) requester.team = str(r.team);
  if (str(r.end_date)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str(r.end_date))) throw new UserError("« end_date » doit être au format AAAA-MM-JJ.");
    requester.end_date = str(r.end_date);
  }

  const e = v.expected as Record<string, unknown> | undefined;
  if (!e || typeof e !== "object") throw new UserError("« expected » est obligatoire.");
  const expected: Expected = {};
  for (const [key, raw] of Object.entries(e)) {
    const val = str(raw);
    if ((SYSTEM_IDS as string[]).includes(key)) {
      if (!isLevel(key, val)) throw new UserError(`Niveau « ${val} » impossible pour ${key}.`);
      expected[key as (typeof SYSTEM_IDS)[number]] = val;
    } else if (key === "expires_before") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) throw new UserError("« expires_before » doit être au format AAAA-MM-JJ.");
      expected.expires_before = val;
    } else if (key === "ticket_status") {
      if (!STATUSES.includes(val)) throw new UserError(`« ticket_status » doit valoir ${STATUSES.join(", ")}.`);
      expected.ticket_status = val;
    } else {
      throw new UserError(`Attendu inconnu « ${key} » (attendus possibles : ${[...SYSTEM_IDS, "expires_before", "ticket_status"].join(", ")}).`);
    }
  }
  if (!Object.keys(expected).length) throw new UserError("« expected » ne contient aucun attendu.");

  const evidence: Evidence[] = Array.isArray(v.evidence)
    ? v.evidence
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof (x as Record<string, unknown>).quote === "string")
        .map((x) => ({ quote: String(x.quote), ...(typeof x.frame_id === "number" ? { frame_id: x.frame_id } : {}) }))
    : [];

  return {
    title,
    origin,
    ticket: { ...(str(t.id) ? { id: str(t.id) } : {}), type: str(t.type) || "access_request", requester },
    expected,
    evidence,
  };
}

async function insertScenario(automationId: number, input: ScenarioInput, addedBy: string) {
  return (await q1<ScenarioRow>(
    "insert into scenarios (automation_id, title, origin, ticket, expected, evidence, added_by) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7) returning *",
    [automationId, input.title, input.origin, JSON.stringify(input.ticket), JSON.stringify(input.expected), JSON.stringify(input.evidence ?? []), addedBy],
  ))!;
}

export async function addScenario(slug: string, value: unknown, addedBy: string) {
  await init();
  const automation = await q1<AutomationRow>("select * from automations where slug = $1", [slug]);
  if (!automation) throw new UserError(`Automatisation « ${slug} » introuvable.`);
  return insertScenario(automation.id, parseScenario(value), addedBy);
}

export async function deleteScenario(id: number, user: string) {
  await init();
  const s = await q1<ScenarioRow & { owner: string }>(
    "select s.*, a.owner from scenarios s join automations a on a.id = s.automation_id where s.id = $1",
    [id],
  );
  if (!s) throw new UserError("Scénario introuvable.");
  if (s.added_by !== user && s.owner !== user) throw new UserError("Seul l'auteur du scénario ou le propriétaire peut le retirer.");
  await q("delete from scenarios where id = $1", [id]);
}

// ---------- Actions exécutées par les automatisations (sur l'app de démo) ----------

async function grant(email: string, system: string, level: string, expires: string | null) {
  if (level === "none") await q("delete from grants where email = $1 and system = $2", [email, system]);
  else {
    await q(
      `insert into grants (email, system, level, expires) values ($1, $2, $3, $4)
       on conflict (email, system) do update set level = excluded.level, expires = excluded.expires`,
      [email, system, level, expires],
    );
  }
}

async function markSaved(email: string) {
  await q("insert into console_saves (email, saved_at) values ($1, now()) on conflict (email) do update set saved_at = now()", [email]);
}

export const demoActions: Actions = {
  "iam.grant": async ({ user, system, level, expires }) => {
    await grant(user, system, level, expires ?? null);
    await markSaved(user);
  },
  "tickets.comment": async ({ id, text }) => {
    const comment = { author: "memopipe", text, at: new Date().toISOString() };
    const r = await q("update tickets set comments = comments || $2::jsonb where id = $1 returning id", [id, JSON.stringify([comment])]);
    if (!r.length) throw new Error(`ticket ${id} introuvable`);
  },
  "tickets.close": async ({ id }) => {
    const r = await q("update tickets set status = 'done' where id = $1 returning id", [id]);
    if (!r.length) throw new Error(`ticket ${id} introuvable`);
  },
};

// ---------- Tests pas à pas ----------

async function insertTicket(t: Ticket) {
  await q(
    "insert into tickets (id, type, status, requester, comments, is_test) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6)",
    [t.id, t.type, t.status, JSON.stringify(t.requester), JSON.stringify(t.comments), !!t.is_test],
  );
}

/** Copie fraîche du ticket du scénario, avec un email dédié : les tests ne se mélangent pas. */
function testTicketFor(s: ScenarioRow, runId: number): Ticket {
  const base = s.ticket.id ?? /T-\d+/.exec(s.origin)?.[0] ?? "T-TEST";
  const [local, domain = "test.example"] = s.ticket.requester.email.split("@");
  return {
    id: `${base}-R${runId}`,
    type: s.ticket.type || "access_request",
    status: "approved",
    requester: { ...s.ticket.requester, email: `${local}+r${runId}@${domain}` },
    comments: [],
    is_test: true,
  };
}

export async function startRun(input: { automationId: number; scenarioId: number; dsl: string; source: string; user: string; batch?: string | null }) {
  await init();
  const program = programOf(input.dsl);
  const scenario = await q1<ScenarioRow>("select * from scenarios where id = $1 and automation_id = $2", [input.scenarioId, input.automationId]);
  if (!scenario) throw new UserError("Scénario introuvable.");
  const created = (await q1<RunRow>(
    "insert into runs (automation_id, scenario_id, source, dsl, created_by, batch) values ($1, $2, $3, $4, $5, $6) returning *",
    [input.automationId, scenario.id, input.source, input.dsl, input.user, input.batch ?? null],
  ))!;
  const ticket = testTicketFor(scenario, created.id);
  await insertTicket(ticket);
  const state = start(program, ticket);
  return save({ ...created, test_ticket: ticket.id, test_email: ticket.requester.email }, state, scenario);
}

async function save(run: RunRow, state: RunState, scenario?: ScenarioRow | null) {
  let result: CompareRow[] | null = null;
  if (state.done) {
    const s = scenario ?? (await q1<ScenarioRow>("select * from scenarios where id = $1", [run.scenario_id]));
    const grants = await q<Grant>("select * from grants where email = $1", [run.test_email]);
    const t = await q1<{ status: Ticket["status"] }>("select status from tickets where id = $1", [run.test_ticket]);
    result = s ? compare(s.expected, grants, { status: t?.status ?? "approved" }) : [];
  }
  const status = !state.done ? "running" : state.error ? "error" : "done";
  return (await q1<RunRow>(
    "update runs set test_ticket = $2, test_email = $3, state = $4::jsonb, status = $5, result = $6::jsonb where id = $1 returning *",
    [run.id, run.test_ticket, run.test_email, JSON.stringify(state), status, result ? JSON.stringify(result) : null],
  ))!;
}

async function runRow(id: number) {
  const run = await q1<RunRow>("select * from runs where id = $1", [id]);
  if (!run) throw new UserError("Test introuvable.");
  return run;
}

export async function stepRun(id: number) {
  await init();
  const run = await runRow(id);
  if (run.state.done) return run;
  return save(run, await step(programOf(run.dsl), run.state, demoActions));
}

export async function finishRun(id: number) {
  await init();
  const run = await runRow(id);
  if (run.state.done) return run;
  return save(run, await runToEnd(programOf(run.dsl), run.state, demoActions));
}

export async function getRun(id: number) {
  await init();
  const run = await q1<RunRow>("select * from runs where id = $1", [id]);
  if (!run) return null;
  const [scenario, automation] = await Promise.all([
    q1<ScenarioRow>("select * from scenarios where id = $1", [run.scenario_id]),
    q1<AutomationRow>("select * from automations where id = $1", [run.automation_id]),
  ]);
  return { run, scenario, automation };
}

export function outcomeOf(run: RunRow): TestOutcome {
  const failures = (run.result ?? []).filter((r) => !r.ok).length;
  return { runId: run.id, passed: run.status === "done" && !run.state.error && failures === 0, failures, error: run.state.error };
}

async function runSuite(input: { automationId: number; dsl: string; source: string; user: string; batch: string }) {
  const program = programOf(input.dsl);
  const scenarios = await q<ScenarioRow>("select * from scenarios where automation_id = $1 order by id", [input.automationId]);
  const out: { scenario: ScenarioRow; outcome: TestOutcome }[] = [];
  for (const scenario of scenarios) {
    const run = await startRun({ ...input, scenarioId: scenario.id });
    const done = await save(run, await runToEnd(program, run.state, demoActions), scenario);
    out.push({ scenario, outcome: outcomeOf(done) });
  }
  return out;
}

/** « Tout tester » sur la version courante. Renvoie l'identifiant du lot pour afficher le tableau. */
export async function testCurrentVersion(slug: string, user: string) {
  const data = await getAutomation(slug);
  if (!data?.current) throw new UserError("Automatisation introuvable.");
  const batch = `v${data.current.number}-${Date.now().toString(36)}`;
  await runSuite({ automationId: data.automation.id, dsl: data.current.dsl, source: `v${data.current.number}`, user, batch });
  return batch;
}

export async function batchResults(automationId: number, batch: string) {
  await init();
  const runs = await q<RunRow & { title: string; origin: string }>(
    "select r.*, s.title, s.origin from runs r join scenarios s on s.id = r.scenario_id where r.automation_id = $1 and r.batch = $2 order by r.id",
    [automationId, batch],
  );
  return runs.map((r) => ({ title: r.title, origin: r.origin, outcome: outcomeOf(r), source: r.source }));
}

// ---------- Copies de travail et contributions ----------

export async function createDraft(slug: string, user: string) {
  const data = await getAutomation(slug);
  if (!data?.current) throw new UserError("Automatisation introuvable.");
  const existing = data.drafts.find((d) => d.author === user && d.status === "draft" && d.base_version === data.current.id);
  if (existing) return existing;
  return (await q1<DraftRow>(
    "insert into drafts (automation_id, base_version, author, dsl) values ($1, $2, $3, $4) returning *",
    [data.automation.id, data.current.id, user, data.current.dsl],
  ))!;
}

export async function getDraft(id: number) {
  await init();
  const draft = await q1<DraftRow>("select * from drafts where id = $1", [id]);
  if (!draft) return null;
  const [automation, base, comments] = await Promise.all([
    q1<AutomationRow>("select * from automations where id = $1", [draft.automation_id]),
    q1<VersionRow>("select * from versions where id = $1", [draft.base_version]),
    q<CommentRow>("select * from comments where draft_id = $1 order by id", [id]),
  ]);
  const current = automation?.current_version ? await q1<VersionRow>("select * from versions where id = $1", [automation.current_version]) : null;
  return { draft, automation: automation!, base: base!, current, comments, stale: draft.base_version !== automation?.current_version };
}

async function draftFor(id: number, user: string) {
  const d = await getDraft(id);
  if (!d) throw new UserError("Copie introuvable.");
  if (d.draft.author !== user) throw new UserError(`Cette copie appartient à ${userName(d.draft.author)}.`);
  return d;
}

export async function saveDraft(id: number, dsl: string, user: string) {
  const d = await draftFor(id, user);
  if (!["draft", "proposed"].includes(d.draft.status)) throw new UserError("Cette contribution est déjà traitée.");
  const c = compile(dsl);
  await q("update drafts set dsl = $2, results = null where id = $1", [id, dsl]);
  if (!c.ok) throw new UserError(`Copie enregistrée, mais elle ne compile pas :\n${formatErrors(c.errors)}`);
}

export async function testDraft(id: number, user: string) {
  const d = await draftFor(id, user);
  const batch = `d${id}-${Date.now().toString(36)}`;
  const base = await runSuite({ automationId: d.automation.id, dsl: d.base.dsl, source: `v${d.base.number}`, user, batch });
  const copy = await runSuite({ automationId: d.automation.id, dsl: d.draft.dsl, source: `copie #${id}`, user, batch });
  const results: TestRow[] = copy.map((c) => ({
    scenarioId: c.scenario.id,
    title: c.scenario.title,
    origin: c.scenario.origin,
    base: base.find((b) => b.scenario.id === c.scenario.id)?.outcome ?? null,
    copy: c.outcome,
  }));
  await q("update drafts set results = $2::jsonb where id = $1", [id, JSON.stringify(results)]);
  return results;
}

export async function proposeDraft(id: number, reason: string, user: string) {
  const d = await draftFor(id, user);
  if (d.draft.status !== "draft") throw new UserError("Cette copie est déjà proposée.");
  if (!reason.trim()) throw new UserError("Explique pourquoi tu proposes cette modification.");
  if (!d.draft.results) throw new UserError("Lance « Tout tester » avant de proposer : la contribution doit contenir ses résultats.");
  if (d.draft.dsl.trim() === d.base.dsl.trim()) throw new UserError("La copie est identique à la version de base.");
  await q("update drafts set status = 'proposed', reason = $2, proposed_at = now() where id = $1", [id, reason.trim()]);
}

export async function addComment(draftId: number, user: string, body: string) {
  await init();
  if (!body.trim()) throw new UserError("Le commentaire est vide.");
  await q("insert into comments (draft_id, author, body) values ($1, $2, $3)", [draftId, user, body.trim()]);
}

export async function approveDraft(id: number, user: string) {
  const d = await getDraft(id);
  if (!d) throw new UserError("Contribution introuvable.");
  if (d.automation.owner !== user) throw new UserError(`Seul le propriétaire (${userName(d.automation.owner)}) peut approuver.`);
  if (d.draft.author === user) throw new UserError("L'auteur d'une contribution ne peut pas l'approuver.");
  if (d.draft.status !== "proposed") throw new UserError("Cette contribution n'est pas en attente.");
  if (d.stale) throw new UserError("Une autre version a été publiée depuis : cette contribution est obsolète.");

  const batch = `a${id}-${Date.now().toString(36)}`;
  const check = await runSuite({ automationId: d.automation.id, dsl: d.draft.dsl, source: `copie #${id}`, user, batch });
  if (check.some((c) => !c.outcome.passed)) throw new UserError("Un scénario échoue sur la copie : approbation impossible.");

  const next = await q1<{ n: number }>("select (coalesce(max(number), 0) + 1)::int as n from versions where automation_id = $1", [d.automation.id]);
  const version = (await q1<VersionRow>(
    "insert into versions (automation_id, number, dsl, author, note, approved_by) values ($1, $2, $3, $4, $5, $6) returning *",
    [d.automation.id, next!.n, d.draft.dsl, d.draft.author, d.draft.reason, user],
  ))!;
  await q("update automations set current_version = $1 where id = $2", [version.id, d.automation.id]);
  await q("update drafts set status = 'approved', decided_by = $2, decided_at = now(), published_version = $3 where id = $1", [id, user, version.number]);
  return version;
}

export async function rejectDraft(id: number, user: string) {
  const d = await getDraft(id);
  if (!d) throw new UserError("Contribution introuvable.");
  if (d.automation.owner !== user) throw new UserError(`Seul le propriétaire (${userName(d.automation.owner)}) peut refuser.`);
  if (d.draft.status !== "proposed") throw new UserError("Cette contribution n'est pas en attente.");
  await q("update drafts set status = 'rejected', decided_by = $2, decided_at = now() where id = $1", [id, user]);
}

export async function listContributions() {
  await init();
  return q<DraftRow & { title: string; slug: string; base_number: number }>(`
    select d.*, a.title, a.slug, v.number as base_number
    from drafts d join automations a on a.id = d.automation_id join versions v on v.id = d.base_version
    where d.status <> 'draft' order by coalesce(d.proposed_at, d.created_at) desc`);
}

// ---------- App de démo : tickets et console des permissions ----------

export async function listTickets() {
  await init();
  return q<Ticket>("select * from tickets where not is_test order by id");
}

export async function getTicket(id: string) {
  await init();
  return q1<Ticket>("select * from tickets where id = $1", [id]);
}

export async function setTicketStatus(id: string, status: Ticket["status"]) {
  await init();
  await q("update tickets set status = $2 where id = $1", [id, status]);
}

export async function addTicketComment(id: string, author: string, text: string) {
  await init();
  if (!text.trim()) return;
  const comment = { author: author.trim() || "Équipe IT", text: text.trim(), at: new Date().toISOString() };
  await q("update tickets set comments = comments || $2::jsonb where id = $1", [id, JSON.stringify([comment])]);
}

export async function getConsole(email: string) {
  await init();
  const [grants, saved, ticket] = await Promise.all([
    q<Grant>("select * from grants where email = $1", [email]),
    q1<{ saved_at: Date | string }>("select saved_at from console_saves where email = $1", [email]),
    q1<Ticket>("select * from tickets where requester->>'email' = $1 order by created_at desc limit 1", [email]),
  ]);
  return { email, person: ticket?.requester ?? null, ticketId: ticket?.id ?? null, grants, savedAt: saved?.saved_at ?? null };
}

export async function saveConsole(email: string, levels: Record<string, string>, expires: string | null) {
  await init();
  for (const system of SYSTEM_IDS) {
    const level = levels[system] ?? "none";
    if (!isLevel(system, level)) throw new UserError(`Niveau « ${level} » impossible pour ${system}.`);
  }
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new UserError("Date d'expiration invalide.");
  for (const system of SYSTEM_IDS) await grant(email, system, levels[system] ?? "none", expires || null);
  await markSaved(email);
}
