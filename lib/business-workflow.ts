import { compile, type Arg, type Expr } from "./dsl";
import { CONTRACTS, isLevel, isSystem, levelLabel, SYSTEM_IDS, systemLabel } from "./labels";

export function businessText(text: string): string {
  return text.replace(/ticket\.requester\.end_date|\bp\.end_date\b/g, "la fin de mission")
    .replace(/ticket\.requester\.contract|\bp\.contract\b/g, "le type de contrat")
    .replace(/ticket\.requester\.email|\bp\.email\b/g, "l’adresse du demandeur")
    .replace(/ticket\.requester|\bp\.name\b/g, "le demandeur")
    .replace(/\bDSL\b/g, "procédure").replace(/\bprestataire\b/g, "prestataire");
}

export function friendlyError(message: string): string {
  if (/iam\.|tickets\.|gmail\.|hors du test|ligne\s+\d/i.test(message)) return "Une action de la procédure ne respecte pas les conditions de cet essai. Faites vérifier ses règles par son responsable avant de continuer.";
  if (/unreachable|ECONNREFUSED|local API|frame storage|database_startup|index is missing|API URL/i.test(message)) return "Votre historique n’est pas accessible. Ouvrez Screenpipe sur votre ordinateur, attendez qu’il soit prêt, puis recommencez l’analyse.";
  if (/401|403|API_KEY|TEAM_TOKEN|AI_MODEL|configurez|configur/i.test(message)) return "La connexion nécessaire n’est pas configurée ou autorisée. Contactez la personne qui gère votre espace.";
  if (/429/.test(message)) return "Le service d’analyse est temporairement indisponible ou son quota est atteint. Réessayez plus tard.";
  if (/agent|canary|timeout|délai dépassé/i.test(message)) return "L’analyse n’a pas abouti. Vérifiez que Screenpipe et la connexion à votre espace sont actifs sur votre ordinateur, puis réessayez.";
  if (/JSON|schéma|références.*invalid|code non autorisé|compil/i.test(message)) return "La proposition ne peut pas être utilisée en toute sécurité. Demandez une nouvelle analyse ou faites vérifier la procédure.";
  return businessText(message);
}

const literal = (arg?: Arg): string | null => arg?.kind === "template" && !arg.value.includes("{{") ? arg.value : arg?.kind === "expr" && arg.expr.k === "lit" ? String(arg.expr.v ?? "") : null;
const fieldNames: Record<string, string> = { contract: "Type de contrat", team: "Équipe", name: "Demandeur", email: "Adresse du demandeur", end_date: "Fin de mission", type: "Type de demande", status: "Statut" };

function humanExpression(e: Expr): string {
  if (e.k === "path") return fieldNames[e.p.at(-1)!] ?? "Valeur de la demande";
  if (e.k === "lit") return CONTRACTS[String(e.v)] ?? (e.v === "access_request" ? "Demande d’accès" : e.v === null ? "non renseigné" : String(e.v));
  if (e.k === "not") return `ne correspond pas à (${humanExpression(e.e)})`;
  const operator = { eq: "est", ne: "n’est pas", contains: "contient", and: "et", or: "ou" }[e.k];
  return `${humanExpression(e.a)} ${operator} ${humanExpression(e.b)}`;
}

export type WorkflowStep = { line: number; title: string; condition: string; kind: "grant" | "comment" | "close" | "other"; system?: string; level?: string; expiry?: "mission" | "none" | "custom"; editable: boolean };

export function workflowSteps(source: string): WorkflowStep[] {
  const c = compile(source); if (!c.ok) return [];
  const conditions: string[] = [];
  const steps: WorkflowStep[] = [];
  for (const i of c.program.instructions) {
    if (i.op === "if") { conditions.length = i.depth; conditions.push(humanExpression(i.cond)); continue; }
    if (i.op === "jump") { conditions.length = i.depth; conditions.push("Autres situations"); continue; }
    conditions.length = Math.min(conditions.length, i.depth);
    if (i.op !== "do") continue;
    const condition = conditions.join(" · ") || "Toutes les demandes";
    if (i.action === "iam.grant") {
      const system = literal(i.args.system), level = literal(i.args.level);
      const expiry = !i.args.expires || (i.args.expires.kind === "expr" && i.args.expires.expr.k === "lit" && i.args.expires.expr.v == null) ? "none" : i.args.expires.kind === "expr" && i.args.expires.expr.k === "path" && i.args.expires.expr.p.at(-1) === "end_date" ? "mission" : "custom";
      const simple = Object.values(i.args).every(a => a.kind === "template" || ["lit", "path"].includes(a.expr.k));
      steps.push({ line: i.line, kind: "grant", condition, system: system ?? undefined, level: level ?? undefined, expiry, editable: !!system && !!level && isLevel(system, level) && simple,
        title: `${system ? systemLabel(system) : "Accès"} : ${system && level ? levelLabel(system, level) : "selon la demande"}${expiry === "mission" ? ", jusqu’à la fin de mission" : expiry === "custom" ? ", avec une limite de durée" : ""}` });
    } else if (i.action === "tickets.comment") steps.push({ line: i.line, condition, kind: "comment", editable: false, title: "Ajouter une note à la demande" });
    else if (i.action === "tickets.close") steps.push({ line: i.line, condition, kind: "close", editable: false, title: "Marquer la demande comme terminée" });
    else steps.push({ line: i.line, condition, kind: "other", editable: false, title: "Effectuer une action complémentaire" });
  }
  return steps;
}

/** Edit declared values only. The server retains all conditions, targets and other operations. */
export function editWorkflow(source: string, fields: FormData): string {
  const c = compile(source); if (!c.ok) throw new Error("Cette procédure doit être vérifiée avant modification.");
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  for (const step of workflowSteps(source).filter(s => s.editable)) {
    const level = fields.get(`level_${step.line}`), expiry = fields.get(`expiry_${step.line}`);
    if (level === null && expiry === null) continue;
    if (typeof level !== "string" || !step.system || !isLevel(step.system, level) || typeof expiry !== "string" || !["none", "mission", "custom"].includes(expiry)) throw new Error("Choisissez des droits et une durée valides.");
    const i = c.program.instructions.find(i => i.line === step.line && i.op === "do");
    if (!i || i.op !== "do") throw new Error("Une étape a changé. Rechargez la page.");
    const args: Record<string, Arg> = { ...i.args, level: { kind: "template", value: level } };
    if (expiry === "none") delete args.expires;
    if (expiry === "mission") args.expires = { kind: "expr", expr: { k: "path", p: ["ticket", "requester", "end_date"] } };
    if (expiry === "custom" && step.expiry !== "custom") throw new Error("Cette durée n’est plus disponible.");
    const values = Object.entries(args).map(([name, arg]) => {
      const value = arg.kind === "template" ? JSON.stringify(arg.value) : arg.expr.k === "path" ? arg.expr.p.join(".") : arg.expr.k === "lit" ? JSON.stringify(arg.expr.v) : null;
      if (value === null) throw new Error("Cette règle demande une vérification complémentaire.");
      return `${name}=${value}`;
    });
    lines[step.line - 1] = `${/^\s*/.exec(lines[step.line - 1])![0]}DO ${i.action} ${values.join(" ")}${i.into ? ` -> ${i.into}` : ""}`;
  }
  const updated = lines.join("\n");
  if (!compile(updated).ok) throw new Error("La modification n’est pas valide. Les règles précédentes ont été conservées.");
  return updated;
}

export function workflowFromForm(fields: FormData): string {
  const instructions = ["SET p = ticket.requester"];
  for (const system of SYSTEM_IDS) {
    const level = String(fields.get(system) ?? "");
    if (!isSystem(system) || !isLevel(system, level)) throw new Error("Choisissez un niveau d’accès pour chaque outil.");
    instructions.push(`DO iam.grant user=p.email system=${JSON.stringify(system)} level=${JSON.stringify(level)}${fields.get("temporary") === "yes" && level !== "none" ? " expires=p.end_date" : ""}`);
  }
  instructions.push('DO tickets.comment id=ticket.id text="Accès attribués selon la procédure validée."', "DO tickets.close id=ticket.id");
  return instructions.join("\n");
}
