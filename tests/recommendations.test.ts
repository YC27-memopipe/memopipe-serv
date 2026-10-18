import { expect, test } from "bun:test";
import { recommendProcedures } from "../lib/recommendations";
import { rehearse } from "../lib/rehearsal";
import { TEST_DSL } from "./fixtures/ai-response";
import { ALICE_AUTOMATION, ALICE_SCENARIO, SCENARIO_EXAMPLE } from "../lib/seed";
import type { CatalogProcedure } from "../lib/recommendations";

const procedure: CatalogProcedure = { ...ALICE_AUTOMATION, version: 1, versionId: 1 };

test("recommend from the submitted procedure, even when observed permission levels differ", () => {
  const result = recommendProcedures([procedure], [SCENARIO_EXAMPLE]);
  expect(result).toHaveLength(1);
  expect(result[0].caseIndexes).toEqual([0]);
  expect(result[0].versionId).toBe(1);
  expect(result[0].parameters).toContain("email");
  expect(result[0].reasons.join(" ")).toContain("peuvent différer");
});

test("a similar title or mail workflow does not create a false recommendation", () => {
  const closeOnly = { ...procedure, slug: "close", dsl: 'DO tickets.close id=ticket.id' };
  const gmail = { ...procedure, slug: "mail", dsl: 'DO gmail.send to=ticket.requester.email subject="Accès" body="Bonjour"' };
  const unrelated = { ...SCENARIO_EXAMPLE, ticket: { ...SCENARIO_EXAMPLE.ticket, type: "expense" } };
  expect(recommendProcedures([closeOnly, gmail], [SCENARIO_EXAMPLE])).toEqual([]);
  expect(recommendProcedures([procedure], [unrelated])).toEqual([]);
  const otherOwner = { ...procedure, slug: "procedure-chloe", owner: "chloe" };
  expect(recommendProcedures([otherOwner], [SCENARIO_EXAMPLE])[0].slug).toBe("procedure-chloe");
});

test("rehearsal verifies code on Alice, Bob and a new requester without generating explanations", async () => {
  const before = await rehearse(procedure.dsl, SCENARIO_EXAMPLE);
  expect(before.rows.filter(r => !r.ok)).toHaveLength(4);
  expect((await rehearse(TEST_DSL, ALICE_SCENARIO)).passed).toBe(true);
  expect((await rehearse(TEST_DSL, SCENARIO_EXAMPLE)).passed).toBe(true);
  const another = structuredClone(SCENARIO_EXAMPLE);
  another.ticket.requester = { name: "Nora Diallo", email: "nora@presta.example", contract: "prestataire", end_date: "2027-03-31" };
  another.expected.expires_before = "2027-03-31";
  expect((await rehearse(TEST_DSL, another)).passed).toBe(true);
});
