// Contrats entre le moteur (dsl.ts, runner.ts), le hub et le script memopipe:analyze.
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

/** Ce que le script memopipe:analyze envoie à POST /api/scenarios (le champ automation désigne le slug). */
export type ScenarioInput = {
  title: string;
  origin: string;
  ticket: { id?: string; type: string; requester: Requester };
  expected: Expected;
  evidence?: Evidence[];
};

/** Actions que le moteur peut appeler. Le hub les implémente sur l'app de démo. */
export type Actions = {
  "iam.grant": (args: { user: string; system: string; level: string; expires?: string | null }) => Promise<void>;
  "tickets.comment": (args: { id: string; text: string }) => Promise<void>;
  "tickets.close": (args: { id: string }) => Promise<void>;
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
