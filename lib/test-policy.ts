import { compile, type Program } from "./dsl";
import type { Actions } from "./types";

export const TEST_ACTIONS = ["iam.grant", "tickets.comment", "tickets.close"] as const;

/** Check every branch before creating resources or calling an adapter. */
export function testProgram(dsl: string): Program {
  if (dsl.length > 30000 || dsl.split("\n").length > 250) throw new Error("Code trop long pour un test (250 lignes maximum).");
  const c = compile(dsl);
  if (!c.ok) throw new Error(c.errors.map(e => `Ligne ${e.line} : ${e.message}`).join("\n"));
  for (const i of c.program.instructions) {
    if (i.op === "do" && !TEST_ACTIONS.includes(i.action as typeof TEST_ACTIONS[number])) {
      throw new Error(`Action ${i.action} interdite dans les tests Nimbus, y compris dans une branche inactive.`);
    }
  }
  return c.program;
}

/** Authority comes from the run, never from generated code or mutable variables. */
export function scopedActions(delegate: Actions, scope: { email: string; ticket: string }): Actions {
  const ticket = (id: string) => { if (id !== scope.ticket) throw new Error("Action bloquée : ticket hors du test."); };
  const external = async (): Promise<never> => { throw new Error("Action externe interdite dans les tests Nimbus."); };
  return {
    "iam.grant": async args => {
      if (args.user !== scope.email) throw new Error("Action bloquée : utilisateur hors du test.");
      await delegate["iam.grant"](args);
    },
    "tickets.comment": async args => { ticket(args.id); await delegate["tickets.comment"](args); },
    "tickets.close": async args => { ticket(args.id); await delegate["tickets.close"](args); },
    "gmail.search": external,
    "gmail.send": external,
  };
}
