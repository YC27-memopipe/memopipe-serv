// Parcours complet de la démo sur un vrai Postgres en mémoire (PGlite).
import { beforeAll, expect, test } from "bun:test";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const data = await import("../lib/data");
const { SCENARIO_EXAMPLE } = await import("../lib/seed");

const BOB_COPY = `SET p = ticket.requester
IF p.contract == "prestataire"
  DO iam.grant user=p.email system="github" level="read" expires=p.end_date
  DO iam.grant user=p.email system="slack" level="guest" expires=p.end_date
ELSE
  DO iam.grant user=p.email system="github" level="write"
  DO iam.grant user=p.email system="vpn-prod" level="access"
  DO iam.grant user=p.email system="slack" level="member"
END
DO tickets.comment id=ticket.id text="Accès attribués ({{p.contract}})."
DO tickets.close id=ticket.id
`;

beforeAll(async () => {
  await data.reset("all");
});

test("le catalogue démarre avec la v1 d'Alice et son scénario CDI", async () => {
  const list = await data.listAutomations();
  expect(list).toHaveLength(1);
  expect(list[0].version).toBe(1);
  expect(list[0].scenarios).toBe(1);
});

test("parcours : scénario de Bob, test pas à pas, copie, contribution, approbation", async () => {
  // Le script memopipe:analyze envoie le scénario validé par Bob.
  const scenario = await data.addScenario("attribuer-acces", { ...SCENARIO_EXAMPLE, origin: "Screenpipe · Bob · T-1182" }, "bob");
  const a = (await data.getAutomation("attribuer-acces"))!;

  // Test pas à pas de la v1 : chaque clic exécute une instruction.
  let run = await data.startRun({ automationId: a.automation.id, scenarioId: scenario.id, dsl: a.current.dsl, source: "v1", user: "bob" });
  expect(run.test_ticket).toBe(`T-1182-R${run.id}`);
  expect(run.test_email).toBe(`ines.fabre+r${run.id}@presta.example`);
  run = await data.stepRun(run.id);
  run = await data.stepRun(run.id);
  expect(run.state.steps).toHaveLength(2);
  expect(run.state.steps[1].detail).toBe("accès créé : GitHub = Écriture");
  run = await data.finishRun(run.id);
  expect(run.status).toBe("done");
  expect(data.outcomeOf(run).failures).toBe(4);

  // Les effets sont réels sur l'app de démo.
  const console1 = await data.getConsole(run.test_email);
  expect(console1.grants.map((g) => g.system).sort()).toEqual(["github", "slack", "vpn-prod"]);
  expect(console1.savedAt).not.toBeNull();

  // Bob modifie une copie, teste tout, propose.
  const draft = await data.createDraft("attribuer-acces", "bob");
  await data.saveDraft(draft.id, BOB_COPY, "bob");
  await expect(data.proposeDraft(draft.id, "Les prestataires recevaient le profil standard.", "bob")).rejects.toThrow("Tout tester");
  const results = await data.testDraft(draft.id, "bob");
  expect(results.map((r) => [r.title, r.base?.passed, r.copy.passed])).toEqual([
    ["CDI développement", true, true],
    ["Prestataire externe, mission de 3 mois", false, true],
  ]);
  await data.proposeDraft(draft.id, "Les prestataires recevaient le profil standard.", "bob");

  // Seule Alice, propriétaire, peut approuver ; jamais l'auteur.
  await expect(data.approveDraft(draft.id, "bob")).rejects.toThrow("propriétaire");
  await data.addComment(draft.id, "alice", "Et les alternants ? Même règle ?");
  const v2 = await data.approveDraft(draft.id, "alice");
  expect(v2.number).toBe(2);
  expect(v2.author).toBe("bob");
  expect(v2.approved_by).toBe("alice");

  const after = (await data.getAutomation("attribuer-acces"))!;
  expect(after.current.number).toBe(2);
  expect(after.drafts[0].status).toBe("approved");
});

test("une contribution partie d'une ancienne version devient obsolète", async () => {
  const a = (await data.getAutomation("attribuer-acces"))!;
  const draft = await data.createDraft("attribuer-acces", "chloe");
  expect(draft.base_version).toBe(a.current.id);
  const d = (await data.getDraft(draft.id))!;
  expect(d.stale).toBe(false);
});

test("un scénario invalide est refusé avec un message clair", async () => {
  await expect(data.addScenario("attribuer-acces", { title: "x", ticket: {}, expected: {} }, "bob")).rejects.toThrow("requester");
  await expect(
    data.addScenario("attribuer-acces", { ...SCENARIO_EXAMPLE, expected: { github: "admin" } }, "bob"),
  ).rejects.toThrow("Niveau");
});

test("la console de démo enregistre et affiche l'état", async () => {
  await data.reset("demo");
  await data.saveConsole("ines.fabre@presta.example", { github: "read", "vpn-prod": "none", slack: "guest" }, "2027-01-15");
  const c = await data.getConsole("ines.fabre@presta.example");
  expect(c.person?.name).toBe("Inès Fabre");
  expect(c.ticketId).toBe("T-1182");
  expect(c.grants.map((g) => `${g.system}:${g.level}:${g.expires}`).sort()).toEqual(["github:read:2027-01-15", "slack:guest:2027-01-15"]);
});
