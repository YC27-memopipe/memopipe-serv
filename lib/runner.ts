// Exécution pas à pas d'une automatisation compilée, et comparaison attendu / obtenu.
import { evaluate, interpolate, truthy, type Program } from "./dsl";
import { CONTRACTS, frDate, isLevel, isSystem, levelLabel, SYSTEM_IDS, SYSTEMS, systemLabel, TICKET_STATUS } from "./labels";
import type { Actions, CompareRow, Expected, Grant, MailSearch, MailSent, RunState, Ticket } from "./types";

function skipJumps(program: Program, state: RunState): RunState {
  const ins = program.instructions;
  let pc = state.pc;
  while (pc < ins.length) {
    const i = ins[pc];
    if (i.op !== "jump") break;
    pc = i.target;
  }
  return { ...state, pc, done: state.done || pc >= ins.length };
}

export function start(program: Program, ticket: Ticket): RunState {
  return skipJumps(program, { pc: 0, vars: { ticket }, steps: [], done: false, error: null });
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return "vide";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.name === "string") {
      return [o.name, CONTRACTS[String(o.contract)] ?? o.contract, o.team].filter(Boolean).join(" · ");
    }
    const json = JSON.stringify(value);
    return json.length > 80 ? `${json.slice(0, 77)}…` : json;
  }
  return String(value);
}

function describeAction(action: keyof Actions, args: Record<string, string | null>, result: unknown): string {
  switch (action) {
    case "iam.grant": {
      const system = args.system ?? "";
      if (args.level === "none") return `accès retiré : ${systemLabel(system)}`;
      const until = args.expires ? ` jusqu'au ${frDate(args.expires)}` : "";
      return `accès créé : ${systemLabel(system)} = ${levelLabel(system, args.level ?? "")}${until}`;
    }
    case "tickets.comment": return `commentaire ajouté : « ${args.text} »`;
    case "tickets.close": return `ticket ${args.id} terminé`;
    case "gmail.search": {
      const r = result as MailSearch;
      const found = `${r.count} email${r.count > 1 ? "s" : ""} trouvé${r.count > 1 ? "s" : ""} dans Gmail pour « ${args.query} »`;
      return r.first ? `${found} · le plus récent : « ${r.first.subject} » de ${r.first.from}` : found;
    }
    case "gmail.send": {
      const r = result as MailSent;
      const redirected = r.redirected ? ` (boîte de test ; destinataire prévu : ${r.to})` : "";
      return `email envoyé depuis Gmail à ${r.delivered_to}${redirected} : « ${args.subject} »`;
    }
  }
}

/** Exécute l'instruction courante et renvoie le nouvel état. */
export async function step(program: Program, state: RunState, actions: Actions): Promise<RunState> {
  if (state.done) return state;
  const inst = program.instructions[state.pc];
  const vars = structuredClone(state.vars);
  const record = (ok: boolean, detail: string) => ({ pc: state.pc, line: inst.line, ok, detail });

  try {
    if (inst.op === "set") {
      const value = evaluate(inst.expr, vars);
      vars[inst.name] = value;
      return skipJumps(program, { ...state, vars, pc: state.pc + 1, steps: [...state.steps, record(true, `${inst.name} = ${describe(value)}`)] });
    }
    if (inst.op === "if") {
      const cond = truthy(evaluate(inst.cond, vars));
      const detail = cond ? "condition vraie" : "condition fausse : on passe à la branche suivante";
      return skipJumps(program, { ...state, vars, pc: cond ? state.pc + 1 : inst.target, steps: [...state.steps, record(true, detail)] });
    }
    if (inst.op === "do") {
      const args: Record<string, string | null> = {};
      for (const [name, arg] of Object.entries(inst.args)) {
        const v = arg.kind === "template" ? interpolate(arg.value, vars) : evaluate(arg.expr, vars);
        args[name] = v === null || v === undefined || v === "" ? null : String(v);
      }
      let result: unknown = null;
      if (inst.action === "iam.grant") {
        const system = args.system ?? "";
        if (!isSystem(system)) throw new Error(`système inconnu « ${system} » (systèmes : ${Object.keys(SYSTEMS).join(", ")})`);
        if (!isLevel(system, args.level ?? "")) throw new Error(`niveau « ${args.level} » impossible pour ${system}`);
        if (!args.user) throw new Error("iam.grant sans utilisateur : la valeur de « user » est vide");
        await actions["iam.grant"]({ user: args.user, system, level: args.level!, expires: args.expires });
      } else if (inst.action === "tickets.comment") {
        await actions["tickets.comment"]({ id: args.id ?? "", text: args.text ?? "" });
      } else if (inst.action === "tickets.close") {
        await actions["tickets.close"]({ id: args.id ?? "" });
      } else if (inst.action === "gmail.search") {
        if (!args.query) throw new Error("gmail.search sans recherche : la valeur de « query » est vide");
        result = await actions["gmail.search"]({ query: args.query, limit: args.limit });
      } else {
        for (const k of ["to", "subject", "body"]) if (!args[k]) throw new Error(`gmail.send : la valeur de « ${k} » est vide`);
        result = await actions["gmail.send"]({ to: args.to!, subject: args.subject!, body: args.body! });
      }
      if (inst.into) vars[inst.into] = result;
      return skipJumps(program, { ...state, vars, pc: state.pc + 1, steps: [...state.steps, record(true, describeAction(inst.action, args, result))] });
    }
    return skipJumps(program, { ...state, pc: inst.target });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ...state, steps: [...state.steps, record(false, message)], done: true, error: message };
  }
}

export async function runToEnd(program: Program, state: RunState, actions: Actions, maxSteps = 200): Promise<RunState> {
  let s = state;
  for (let n = 0; !s.done && n < maxSteps; n++) s = await step(program, s, actions);
  if (!s.done) return { ...s, done: true, error: `arrêt après ${maxSteps} étapes` };
  return s;
}

/** Compare l'état final (accès du demandeur, statut du ticket) aux attendus du scénario. */
export function compare(expected: Expected, grants: Grant[], ticket: Pick<Ticket, "status">): CompareRow[] {
  const rows: CompareRow[] = [];
  const bySystem = new Map(grants.map((g) => [g.system, g]));
  for (const system of SYSTEM_IDS) {
    const want = expected[system];
    if (want === undefined) continue;
    const got = bySystem.get(system)?.level ?? "none";
    rows.push({
      key: system,
      label: systemLabel(system),
      expected: levelLabel(system, want),
      obtained: levelLabel(system, got),
      ok: got === want,
    });
  }
  if (expected.expires_before) {
    const active = grants.filter((g) => g.level !== "none");
    const missing = active.some((g) => !g.expires);
    const latest = active.map((g) => g.expires ?? "").sort().at(-1) ?? "";
    rows.push({
      key: "expires_before",
      label: "Expiration",
      expected: `au plus tard le ${frDate(expected.expires_before)}`,
      obtained: active.length === 0 ? "aucun accès" : missing ? "aucune" : `le ${frDate(latest)}`,
      ok: active.every((g) => !!g.expires && g.expires <= expected.expires_before!),
    });
  }
  if (expected.ticket_status) {
    rows.push({
      key: "ticket_status",
      label: "Ticket",
      expected: TICKET_STATUS[expected.ticket_status] ?? expected.ticket_status,
      obtained: TICKET_STATUS[ticket.status] ?? ticket.status,
      ok: ticket.status === expected.ticket_status,
    });
  }
  return rows;
}
