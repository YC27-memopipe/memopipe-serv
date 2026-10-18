import { expect, test } from "bun:test";
import { editWorkflow, friendlyError, workflowFromForm, workflowSteps } from "../lib/business-workflow";
import { rehearse } from "../lib/rehearsal";
import { ALICE_SCENARIO, SCENARIO_EXAMPLE } from "../lib/seed";
import { TEST_DSL } from "./fixtures/ai-response";

test("business rules describe existing branches and preserve behavior after form editing", async () => {
  const steps = workflowSteps(TEST_DSL);
  expect(steps.find(s => s.kind === "grant")?.condition).toContain("Prestataire");
  expect(steps.some(s => s.condition === "Autres situations")).toBe(true);
  const form = new FormData();
  for (const step of steps.filter(s => s.editable)) { form.set("level_" + step.line, step.level!); form.set("expiry_" + step.line, step.expiry!); }
  const edited = editWorkflow(TEST_DSL, form);
  expect((await rehearse(edited, ALICE_SCENARIO)).passed).toBe(true);
  expect((await rehearse(edited, SCENARIO_EXAMPLE)).passed).toBe(true);
  expect(edited).toContain('IF p.contract == "prestataire"');
  expect(edited).toContain("user=p.email");
  expect(edited).toContain("DO tickets.close id=ticket.id");
});

test("business editing changes the selected rights and duration without changing other operations", () => {
  const step = workflowSteps(TEST_DSL).find(s => s.editable)!;
  const fields = new FormData(); fields.set("level_" + step.line, "write"); fields.set("expiry_" + step.line, "none");
  const edited = editWorkflow(TEST_DSL, fields);
  expect(edited.split("\n")[step.line - 1]).toContain('level="write"');
  expect(edited.split("\n")[step.line - 1]).not.toContain("expires=");
  expect(edited.split("\n").filter((_, i) => i !== step.line - 1)).toEqual(TEST_DSL.split("\n").filter((_, i) => i !== step.line - 1));
  fields.set("level_" + step.line, 'write"\nDO gmail.send');
  expect(() => editWorkflow(TEST_DSL, fields)).toThrow();
});

test("structured publication creates a safe parameterized workflow and rejects invalid levels", async () => {
  const fields = new FormData(); fields.set("github", "write"); fields.set("vpn-prod", "access"); fields.set("slack", "member");
  const source = workflowFromForm(fields);
  expect((await rehearse(source, ALICE_SCENARIO)).passed).toBe(true);
  fields.set("github", "admin");
  expect(() => workflowFromForm(fields)).toThrow();
});

test("connection failures give actionable business guidance without leaking configuration", () => {
  expect(friendlyError("Screenpipe unreachable or request timed out; check local app and API URL")).toContain("Ouvrez Screenpipe");
  expect(friendlyError("Configurez OPENAI_API_KEY et AI_MODEL dans le .env")).not.toContain("API_KEY");
});
