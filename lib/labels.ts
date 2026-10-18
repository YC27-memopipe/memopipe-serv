// Libellés partagés par le moteur, le hub et l'app de démo.
// Le texte affiché par la console de démo est lu par le script canary:analyze : ne pas le changer sans lui.

export const SYSTEMS = {
  github: { label: "GitHub", levels: { none: "Aucun", read: "Lecture seule", write: "Écriture" } },
  "vpn-prod": { label: "VPN production", levels: { none: "Non", access: "Oui" } },
  slack: { label: "Slack", levels: { none: "Aucun", guest: "Invité", member: "Membre" } },
} as const satisfies Record<string, { label: string; levels: Record<string, string> }>;

export type SystemId = keyof typeof SYSTEMS;
export const SYSTEM_IDS = Object.keys(SYSTEMS) as SystemId[];

export function isSystem(value: string): value is SystemId {
  return Object.prototype.hasOwnProperty.call(SYSTEMS, value);
}

export function isLevel(system: string, level: string): boolean {
  return isSystem(system) && Object.prototype.hasOwnProperty.call(SYSTEMS[system].levels, level);
}

export function systemLabel(system: string): string {
  return isSystem(system) ? SYSTEMS[system].label : system;
}

export function levelLabel(system: string, level: string): string {
  if (!isSystem(system)) return level;
  const levels: Record<string, string> = SYSTEMS[system].levels;
  return levels[level] ?? level;
}

export const CONTRACTS: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  stagiaire: "Stagiaire",
  alternant: "Alternant",
  prestataire: "Prestataire",
};

export const TICKET_STATUS: Record<string, string> = {
  open: "Ouvert",
  approved: "Approuvé",
  done: "Terminé",
};

/** "2027-01-15" → "15/01/2027" */
export function frDate(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Date et heure de Paris : "18/10/2026 à 09:24" */
export function frDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} à ${get("hour")}:${get("minute")}`;
}

/** « en tant qu'Alice », « en tant que Bob ». */
export const enTantQue = (name: string) => (/^[aeiouyàâéèêîôû]/i.test(name) ? `en tant qu'${name}` : `en tant que ${name}`);
