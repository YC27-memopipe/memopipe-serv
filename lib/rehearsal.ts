import { compare, runToEnd, start } from "./runner";
import { scopedActions, testProgram } from "./test-policy";
import type { Actions, CompareRow, Grant, ScenarioInput, Ticket } from "./types";

/** Execution verifies proposals; it never generates a diagnosis or a correction. */
export async function rehearse(dsl: string, scenario: ScenarioInput): Promise<{ passed: boolean; rows: CompareRow[]; error: string | null }> {
  let program;
  try { program = testProgram(dsl); } catch (e) { return { passed: false, rows: [], error: (e as Error).message }; }
  const ticket: Ticket = { ...structuredClone(scenario.ticket), id: "REHEARSAL", status: "approved", comments: [], requester: { ...scenario.ticket.requester, email: "rehearsal@nimbus.example" } };
  const grants = new Map<string, Grant>();
  const external = async (): Promise<never> => { throw new Error("Action externe interdite."); };
  const actions: Actions = {
    "iam.grant": async a => { grants.set(a.system, { email: a.user, system: a.system, level: a.level, expires: a.expires ?? null }); },
    "tickets.comment": async () => {},
    "tickets.close": async () => { ticket.status = "done"; },
    "gmail.search": external, "gmail.send": external,
  };
  const state = await runToEnd(program, start(program, ticket), scopedActions(actions, { email: ticket.requester.email, ticket: ticket.id }));
  const rows = compare(scenario.expected, [...grants.values()], ticket);
  return { passed: !state.error && rows.every(r => r.ok), rows, error: state.error };
}
