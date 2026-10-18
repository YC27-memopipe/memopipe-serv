// Contrats entre le moteur (dsl.ts, runner.ts), le hub et le script canary:analyze.
import type { SystemId } from "./labels";

export type Requester = {
  name: string;
  email: string;
  contract: string;
  team?: string;
  end_date?: string | null;
};

export type TicketComment = { author: string; text: string; at: string };

export type Ticket = {
  id: string;
  type: string;
  status: "open" | "approved" | "done";
  requester: Requester;
  comments: TicketComment[];
  is_test?: boolean;
};

export type Grant = { email: string; system: string; level: string; expires: string | null };

/** Accès attendus à la fin d'un test. `none` veut dire « aucun accès ». */
export type Expected = Partial<Record<SystemId, string>> & {
  expires_before?: string;
  ticket_status?: string;
};

export type Evidence = { frame_id?: number; quote: string };

/** Ce que le script canary:analyze envoie à POST /api/scenarios (le champ automation désigne le slug). */
export type ScenarioInput = {
  title: string;
  origin: string;
  ticket: { id?: string; type: string; requester: Requester };
  expected: Expected;
  evidence?: Evidence[];
};

/** Un email Gmail lu par Screenpipe (connexion IMAP). */
export type Mail = { id: number; from: string; to: string; subject: string; date: string; snippet?: string };
export type MailSearch = { count: number; first: Mail | null; items: Mail[] };
export type MailSent = { to: string; delivered_to: string; redirected: boolean };

/**
 * Actions que le moteur peut appeler. Le hub implémente iam.* et tickets.* sur l'app de démo ;
 * les actions gmail.* sont réelles : l'agent local les exécute sur le PC, via Screenpipe.
 */
export type Actions = {
  "iam.grant": (args: { user: string; system: string; level: string; expires?: string | null }) => Promise<void>;
  "tickets.comment": (args: { id: string; text: string }) => Promise<void>;
  "tickets.close": (args: { id: string }) => Promise<void>;
  "gmail.search": (args: { query: string; limit?: string | null }) => Promise<MailSearch>;
  "gmail.send": (args: { to: string; subject: string; body: string }) => Promise<MailSent>;
};
export type ActionName = keyof Actions;

/** Résultat d'une étape exécutée. */
export type StepResult = { pc: number; line: number; ok: boolean; detail: string };

/** État d'un test pas à pas : tient en JSON, stocké en base entre deux clics. */
export type RunState = {
  pc: number;
  vars: Record<string, unknown>;
  steps: StepResult[];
  done: boolean;
  error: string | null;
};

/** Une ligne du tableau attendu / obtenu. */
export type CompareRow = { key: string; label: string; expected: string; obtained: string; ok: boolean };
