import { describe, expect, test } from "bun:test";
import { compile, type Program } from "../lib/dsl";
import { compare, runToEnd, start } from "../lib/runner";
import { ALICE_AUTOMATION, SCENARIO_EXAMPLE } from "../lib/seed";
import type { Actions, Grant, Ticket } from "../lib/types";

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

function memory() {
  const grants: Grant[] = [];
  const ticket: Ticket = { id: "T-1", type: "access_request", status: "approved", requester: SCENARIO_EXAMPLE.ticket.requester, comments: [] };
  const actions: Actions = {
    "iam.grant": async ({ user, system, level, expires }) => {
      const i = grants.findIndex((g) => g.email === user && g.system === system);
      if (i >= 0) grants.splice(i, 1);
      if (level !== "none") grants.push({ email: user, system, level, expires: expires ?? null });
    },
    "tickets.comment": async ({ text }) => {
      ticket.comments.push({ author: "memopipe", text, at: "" });
    },
    "tickets.close": async () => {
      ticket.status = "done";
    },
    "gmail.search": async ({ query }) => {
      const items = query.includes("Fabre")
        ? [{ id: 7, from: "karim.haddad@nimbus.example", to: "it@nimbus.example", subject: "Accès pour Inès Fabre", date: "2026-10-16", snippet: "Prestataire, pas de VPN prod." }]
        : [];
      return { count: items.length, first: items[0] ?? null, items };
    },
    "gmail.send": async ({ to }) => {
      sent.push(to);
      return { to, delivered_to: to, redirected: false };
    },
  };
  const sent: string[] = [];
  return { grants, ticket, actions, sent };
}

function program(dsl: string): Program {
  const c = compile(dsl);
  if (!c.ok) throw new Error(JSON.stringify(c.errors));
  return c.program;
}

describe("compile", () => {
  test("refuse une action inconnue", () => {
    const c = compile(`DO iam.delete_everything user="x"`);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.errors[0].message).toContain("action inconnue");
  });

  test("refuse un IF sans END et un ELSE orphelin", () => {
    const a = compile(`IF true\nDO tickets.close id="T-1"`);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.errors.some((e) => e.message === "IF sans END")).toBe(true);
    const b = compile(`ELSE`);
    expect(b.ok).toBe(false);
  });

  test("refuse un niveau impossible écrit en dur", () => {
    const c = compile(`DO iam.grant user="a@b.c" system="vpn-prod" level="write"`);
    expect(c.ok).toBe(false);
  });

  test("IF / ELSE se compilent avec les bons sauts", () => {
    const p = program(BOB_COPY);
    const ops = p.instructions.map((i) => i.op);
    expect(ops).toEqual(["set", "if", "do", "do", "jump", "do", "do", "do", "do", "do"]);
    const iff = p.instructions[1] as Extract<(typeof p.instructions)[number], { op: "if" }>;
    const jump = p.instructions[4] as Extract<(typeof p.instructions)[number], { op: "jump" }>;
    expect(iff.target).toBe(5);
    expect(jump.target).toBe(8);
  });

  test("la v1 d'Alice compile, avec son titre", () => {
    const p = program(ALICE_AUTOMATION.dsl);
    expect(p.title).toBe("Attribuer les accès d'un nouvel arrivant");
    expect(p.instructions).toHaveLength(6);
  });
});

describe("exécution et comparaison", () => {
  test("la v1 d'Alice donne exactement 4 écarts sur le prestataire", async () => {
    const m = memory();
    const end = await runToEnd(program(ALICE_AUTOMATION.dsl), start(program(ALICE_AUTOMATION.dsl), m.ticket), m.actions);
    expect(end.error).toBeNull();
    const rows = compare(SCENARIO_EXAMPLE.expected, m.grants, m.ticket);
    expect(rows.filter((r) => !r.ok).map((r) => r.key)).toEqual(["github", "vpn-prod", "slack", "expires_before"]);
  });

  test("la copie de Bob ne donne aucun écart sur le prestataire", async () => {
    const m = memory();
    const p = program(BOB_COPY);
    const end = await runToEnd(p, start(p, m.ticket), m.actions);
    expect(end.error).toBeNull();
    expect(compare(SCENARIO_EXAMPLE.expected, m.grants, m.ticket).every((r) => r.ok)).toBe(true);
    expect(m.ticket.comments[0].text).toBe("Accès attribués (prestataire).");
  });

  test("chaque étape garde son résultat lisible", async () => {
    const m = memory();
    const p = program(ALICE_AUTOMATION.dsl);
    const end = await runToEnd(p, start(p, m.ticket), m.actions);
    expect(end.steps.map((s) => s.detail)).toEqual([
      "p = Inès Fabre · Prestataire · data",
      "accès créé : GitHub = Écriture",
      "accès créé : VPN production = Oui",
      "accès créé : Slack = Membre",
      "commentaire ajouté : « Accès standards attribués. »",
      "ticket T-1 terminé",
    ]);
  });

  test("gmail.search range son résultat avec -> et contains lit le contenu de l'email", async () => {
    const m = memory();
    const p = program(`SET p = ticket.requester
DO gmail.search query="{{p.name}}" limit="3" -> mails
IF mails.count == 0
  DO tickets.comment id=ticket.id text="aucun email"
ELSE
  IF mails.first.snippet contains "VPN PROD"
    DO tickets.comment id=ticket.id text="consigne du manager : {{mails.first.subject}}"
  END
END
DO gmail.send to=p.email subject="Vos accès" body="Bonjour {{p.name}}" -> envoi`);
    const end = await runToEnd(p, start(p, m.ticket), m.actions);
    expect(end.error).toBeNull();
    expect(m.ticket.comments.map((c) => c.text)).toEqual(["consigne du manager : Accès pour Inès Fabre"]);
    expect(m.sent).toEqual(["ines.fabre@presta.example"]);
    expect(end.steps[1].detail).toContain("1 email trouvé dans Gmail");
    expect(end.steps.at(-1)?.detail).toBe("email envoyé depuis Gmail à ines.fabre@presta.example : « Vos accès »");
    expect((end.vars.envoi as { delivered_to: string }).delivered_to).toBe("ines.fabre@presta.example");
  });

  test("gmail.send exige un destinataire, un sujet et un corps", () => {
    const c = compile(`DO gmail.send to="a@b.c" subject="x"`);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.errors[0].message).toContain("body");
  });

  test("une valeur vide pour user arrête le test avec un message clair", async () => {
    const m = memory();
    const p = program(`DO iam.grant user=nobody.email system="github" level="read"`);
    const end = await runToEnd(p, start(p, m.ticket), m.actions);
    expect(end.error).toContain("sans utilisateur");
    expect(end.steps.at(-1)?.ok).toBe(false);
  });
});
