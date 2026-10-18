// Langage des automatisations : SET, DO, IF / ELSE / END.
// Le texte est compilé en une liste d'instructions numérotées avec des sauts,
// ce qui permet d'exécuter une automatisation une instruction à la fois.
import { isLevel, isSystem, SYSTEMS } from "./labels";
import type { ActionName } from "./types";

export const ACTIONS: Record<ActionName, { required: string[]; optional: string[]; real?: boolean }> = {
  "iam.grant": { required: ["user", "system", "level"], optional: ["expires"] },
  "tickets.comment": { required: ["id", "text"], optional: [] },
  "tickets.close": { required: ["id"], optional: [] },
  // Actions réelles, exécutées sur le PC par l'agent local, via Screenpipe.
  "gmail.search": { required: ["query"], optional: ["limit"], real: true },
  "gmail.send": { required: ["to", "subject", "body"], optional: [], real: true },
};

export type Expr =
  | { k: "lit"; v: string | number | boolean | null }
  | { k: "path"; p: string[] }
  | { k: "not"; e: Expr }
  | { k: "and" | "or" | "eq" | "ne" | "contains"; a: Expr; b: Expr };

export type Arg = { kind: "template"; value: string } | { kind: "expr"; expr: Expr };

export type Instruction =
  | { op: "set"; line: number; depth: number; name: string; expr: Expr }
  | { op: "do"; line: number; depth: number; action: ActionName; args: Record<string, Arg>; into?: string }
  | { op: "if"; line: number; depth: number; cond: Expr; target: number }
  | { op: "jump"; line: number; depth: number; target: number };

export type Program = { title?: string; usage?: string; instructions: Instruction[] };
export type DslError = { line: number; message: string };
export type CompileResult = { ok: true; program: Program } | { ok: false; errors: DslError[] };

class SyntaxErr extends Error {}

// ---------- Expressions ----------

type Tok = { t: "str"; v: string } | { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/;
const FORBIDDEN = ["__proto__", "prototype", "constructor"];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\\" && j + 1 < src.length) { s += src[j + 1]; j += 2; } else s += src[j++];
      }
      if (j >= src.length) throw new SyntaxErr("chaîne non fermée");
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    if (src.startsWith("==", i) || src.startsWith("!=", i)) { out.push({ t: "op", v: src.slice(i, i + 2) }); i += 2; continue; }
    if (c === "(" || c === ")") { out.push({ t: "op", v: c }); i++; continue; }
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = IDENT.exec(src.slice(i));
    if (id) { out.push({ t: "id", v: id[0] }); i += id[0].length; continue; }
    throw new SyntaxErr(`caractère inattendu « ${c} »`);
  }
  return out;
}

export function parseExpr(src: string): Expr {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const isWord = (w: string) => peek()?.t === "id" && peek()?.v === w;

  const primary = (): Expr => {
    const t = toks[i++];
    if (!t) throw new SyntaxErr("expression incomplète");
    if (t.t === "str" || t.t === "num") return { k: "lit", v: t.v };
    if (t.t === "op" && t.v === "(") {
      const e = or();
      const close = toks[i++];
      if (!close || close.t !== "op" || close.v !== ")") throw new SyntaxErr("parenthèse non fermée");
      return e;
    }
    if (t.t === "id") {
      if (t.v === "true") return { k: "lit", v: true };
      if (t.v === "false") return { k: "lit", v: false };
      if (t.v === "null") return { k: "lit", v: null };
      if (["and", "or", "not", "contains"].includes(t.v)) throw new SyntaxErr(`« ${t.v} » mal placé`);
      const p = t.v.split(".");
      if (p.some(s => FORBIDDEN.includes(s))) throw new SyntaxErr("chemin réservé interdit");
      return { k: "path", p };
    }
    throw new SyntaxErr(`« ${t.v} » inattendu`);
  };
  const cmp = (): Expr => {
    const a = primary();
    const t = peek();
    if (t?.t === "op" && (t.v === "==" || t.v === "!=")) {
      i++;
      return { k: t.v === "==" ? "eq" : "ne", a, b: primary() };
    }
    if (isWord("contains")) {
      i++;
      return { k: "contains", a, b: primary() };
    }
    return a;
  };
  const not = (): Expr => {
    if (isWord("not")) { i++; return { k: "not", e: not() }; }
    return cmp();
  };
  const and = (): Expr => {
    let a = not();
    while (isWord("and")) { i++; a = { k: "and", a, b: not() }; }
    return a;
  };
  const or = (): Expr => {
    let a = and();
    while (isWord("or")) { i++; a = { k: "or", a, b: and() }; }
    return a;
  };

  const e = or();
  if (i < toks.length) throw new SyntaxErr(`« ${String(toks[i].v)} » inattendu`);
  return e;
}

export function lookup(vars: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = vars;
  for (const seg of path) {
    if (FORBIDDEN.includes(seg)) return null;
    if (cur === null || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, seg)) return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur ?? null;
}

export function truthy(v: unknown): boolean {
  return !(v === null || v === undefined || v === false || v === "" || v === 0);
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === "object" || typeof b === "object") return false;
  return String(a) === String(b);
}

export function evaluate(e: Expr, vars: Record<string, unknown>): unknown {
  switch (e.k) {
    case "lit": return e.v;
    case "path": return lookup(vars, e.p);
    case "not": return !truthy(evaluate(e.e, vars));
    case "and": return truthy(evaluate(e.a, vars)) && truthy(evaluate(e.b, vars));
    case "or": return truthy(evaluate(e.a, vars)) || truthy(evaluate(e.b, vars));
    case "eq": return same(evaluate(e.a, vars), evaluate(e.b, vars));
    case "ne": return !same(evaluate(e.a, vars), evaluate(e.b, vars));
    case "contains": {
      const hay = evaluate(e.a, vars);
      const needle = evaluate(e.b, vars);
      if (hay == null || needle == null) return false;
      return String(hay).toLowerCase().includes(String(needle).toLowerCase());
    }
  }
}

const PLACEHOLDER = /\{\{\s*([^}]*?)\s*\}\}/g;

export function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER, (_, path: string) => {
    const v = lookup(vars, path.split("."));
    return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}

function checkTemplate(template: string) {
  for (const [, path] of template.matchAll(PLACEHOLDER)) {
    if (!IDENT.test(path) || IDENT.exec(path)?.[0] !== path) throw new SyntaxErr(`interpolation invalide « {{${path}}} »`);
  }
}

// ---------- Instructions ----------

function parseStringLiteral(src: string): string {
  const toks = tokenize(src);
  if (toks.length !== 1 || toks[0].t !== "str") throw new SyntaxErr("une chaîne entre guillemets est attendue");
  return toks[0].v;
}

const ARG = /([A-Za-z_][A-Za-z0-9_]*)=("(?:[^"\\]|\\.)*"|[^\s"]+)/y;

function parseDo(full: string, line: number, depth: number): Instruction {
  // « -> nom » en fin de ligne range le résultat de l'action dans une variable.
  const arrow = /\s*->\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(full);
  const rest = arrow ? full.slice(0, arrow.index) : full;
  const into = arrow?.[1];
  if (into && FORBIDDEN.includes(into)) throw new SyntaxErr("variable réservée interdite");
  if (into === "ticket") throw new SyntaxErr("« ticket » est réservé au ticket du test");
  const head = /^([A-Za-z]+\.[A-Za-z_]+)(?:\s+|$)/.exec(rest);
  if (!head) throw new SyntaxErr("DO attend une action, par exemple « DO iam.grant … »");
  const action = head[1] as ActionName;
  const spec = ACTIONS[action];
  if (!spec) throw new SyntaxErr(`action inconnue « ${head[1]} » (actions : ${Object.keys(ACTIONS).join(", ")})`);

  const args: Record<string, Arg> = {};
  let pos = head[0].length;
  while (pos < rest.length) {
    while (pos < rest.length && /\s/.test(rest[pos])) pos++;
    if (pos >= rest.length) break;
    ARG.lastIndex = pos;
    const m = ARG.exec(rest);
    if (!m) throw new SyntaxErr(`argument mal formé près de « ${rest.slice(pos, pos + 20)} » (forme attendue : nom=valeur)`);
    const [, name, raw] = m;
    if (![...spec.required, ...spec.optional].includes(name)) throw new SyntaxErr(`argument inconnu « ${name} » pour ${action}`);
    if (raw.startsWith('"')) {
      const value = parseStringLiteral(raw);
      checkTemplate(value);
      args[name] = { kind: "template", value };
    } else {
      args[name] = { kind: "expr", expr: parseExpr(raw) };
    }
    pos = ARG.lastIndex;
  }
  for (const r of spec.required) if (!args[r]) throw new SyntaxErr(`argument manquant « ${r} » pour ${action}`);

  if (action === "iam.grant") {
    const sys = args.system;
    const lvl = args.level;
    const literal = (a?: Arg) => (a?.kind === "template" && !a.value.includes("{{") ? a.value : null);
    const s = literal(sys);
    const l = literal(lvl);
    if (s !== null && !isSystem(s)) throw new SyntaxErr(`système inconnu « ${s} » (systèmes : ${Object.keys(SYSTEMS).join(", ")})`);
    if (s !== null && l !== null && !isLevel(s, l)) {
      throw new SyntaxErr(`niveau « ${l} » impossible pour ${s} (niveaux : ${Object.keys(SYSTEMS[s as keyof typeof SYSTEMS].levels).join(", ")})`);
    }
  }
  return { op: "do", line, depth, action, args, ...(into ? { into } : {}) };
}

export function compile(dsl: string): CompileResult {
  if (dsl.length > 30000 || dsl.split("\n").length > 250) return { ok: false, errors: [{ line: 1, message: "code trop long (250 lignes maximum)" }] };
  const lines = dsl.replace(/\r\n?/g, "\n").split("\n");
  const instructions: Instruction[] = [];
  const errors: DslError[] = [];
  const blocks: { ifIdx: number; elseIdx: number | null; line: number }[] = [];
  let title: string | undefined;
  let usage: string | undefined;

  lines.forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    const keyword = s.split(/\s+/, 1)[0];
    const rest = s.slice(keyword.length).trim();
    const depth = blocks.length;
    try {
      switch (keyword) {
        case "AUTOMATION": title = parseStringLiteral(rest); break;
        case "USAGE": usage = parseStringLiteral(rest); break;
        case "SET": {
          const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(rest);
          if (!m) throw new SyntaxErr("forme attendue : SET nom = expression");
          if (m[1] === "ticket") throw new SyntaxErr("« ticket » est réservé au ticket du test");
          if (FORBIDDEN.includes(m[1])) throw new SyntaxErr("variable réservée interdite");
          instructions.push({ op: "set", line, depth, name: m[1], expr: parseExpr(m[2]) });
          break;
        }
        case "DO": instructions.push(parseDo(rest, line, depth)); break;
        case "IF": {
          if (!rest) throw new SyntaxErr("IF attend une condition");
          instructions.push({ op: "if", line, depth, cond: parseExpr(rest), target: -1 });
          blocks.push({ ifIdx: instructions.length - 1, elseIdx: null, line });
          break;
        }
        case "ELSE": {
          const top = blocks.at(-1);
          if (!top) throw new SyntaxErr("ELSE sans IF");
          if (top.elseIdx !== null) throw new SyntaxErr("deux ELSE pour le même IF");
          instructions.push({ op: "jump", line, depth: depth - 1, target: -1 });
          top.elseIdx = instructions.length - 1;
          (instructions[top.ifIdx] as Extract<Instruction, { op: "if" }>).target = instructions.length;
          break;
        }
        case "END": {
          const top = blocks.pop();
          if (!top) throw new SyntaxErr("END sans IF");
          if (top.elseIdx !== null) (instructions[top.elseIdx] as Extract<Instruction, { op: "jump" }>).target = instructions.length;
          else (instructions[top.ifIdx] as Extract<Instruction, { op: "if" }>).target = instructions.length;
          break;
        }
        default:
          throw new SyntaxErr(`instruction inconnue « ${keyword} » (instructions : SET, DO, IF, ELSE, END)`);
      }
    } catch (e) {
      errors.push({ line, message: e instanceof Error ? e.message : String(e) });
    }
  });
  for (const open of blocks) errors.push({ line: open.line, message: "IF sans END" });
  if (!errors.length && !instructions.length) errors.push({ line: 1, message: "l'automatisation ne contient aucune instruction" });

  return errors.length ? { ok: false, errors } : { ok: true, program: { title, usage, instructions } };
}
