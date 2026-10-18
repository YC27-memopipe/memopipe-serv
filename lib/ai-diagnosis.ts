import { audit, ensureAiSchema, fingerprint } from "./audit";
import { aiConfig, aiSettings, callAi } from "./ai-client";
import { contextHash, INPUT_POLICY, minimize, PROMPT_VERSION, type AiContext, type AiResponse } from "./ai-contract";
import { createDraft, getAutomation, getDraft, getRun, saveDraft, testDraft, UserError } from "./data";
import { q, q1 } from "./db";
import { rehearse } from "./rehearsal";

type Check = { case_id: number; passed: boolean; error: string | null };
export type AnalysisRow = {
  id: number; run_id: number; actor: string; fingerprint: string; provider: string; model: string; prompt_version: string;
  request: AiContext; response: AiResponse | null; checks: Check[] | null;
  status: "pending" | "ready" | "blocked" | "failed"; error: string | null; draft_id: number | null; created_at: string;
};

export async function diagnosisPreview(id: number, actor: string) {
  const r = await getRun(id);
  if (!r?.automation || !r.scenario || r.run.created_by !== actor) throw new UserError("Ce test ne vous appartient pas.");
  if (!r.run.state.done || (!r.run.state.error && r.run.result?.every(row => row.ok))) throw new UserError("Le diagnostic IA nécessite un test terminé en échec.");
  const a = await getAutomation(r.automation.slug);
  if (!a || r.run.dsl !== a.current.dsl || r.run.source !== `v${a.current.number}`) throw new UserError("Testez la version publiée courante avant de demander un diagnostic IA.");
  if (a.scenarios.length > 30) throw new UserError("Le diagnostic IA est limité à 30 cas validés.");
  const settings = aiSettings();
  const context: AiContext = minimize({
    schema_version: "memopipe-diagnosis-input/v1",
    automation: { version_id: a.current.id, dsl: r.run.dsl },
    failure: { case_id: r.scenario.id, input: r.scenario.ticket, expected: r.scenario.expected, actual: r.run.result ?? [], error: r.run.state.error, steps: r.run.state.steps },
    regression_cases: a.scenarios.map(s => ({ case_id: s.id, input: s.ticket, expected: s.expected })),
    // No other member's private captures are sent by Bob's consent.
    evidence: r.scenario.added_by !== actor ? [] : r.scenario.evidence.slice(0, 30).map((e, i) => ({
      id: `case-${r.scenario!.id}-evidence-${i + 1}`, quote: e.quote.slice(0, 2000),
      provenance: /screenpipe/i.test(r.scenario!.origin) && !/ficti|synthetic/i.test(r.scenario!.origin) ? "recorded" as const : "synthetic-or-manual" as const,
    })),
    policy: INPUT_POLICY,
  }, a.scenarios, [r.run.test_email, r.run.test_ticket]);
  if (Buffer.byteLength(JSON.stringify(context)) > 60000) throw new UserError("Contexte trop volumineux pour l’IA. Réduisez les cas ou les citations.");
  // Include exact source/corpus state so a changed scenario invalidates consent and proposals.
  const hash = fingerprint({ context: contextHash(context, settings.provider, settings.model), scenarios: a.scenarios, run: r.run, version: a.current });
  return { context, hash, settings, scenarios: a.scenarios, slug: a.automation.slug, base: a.current };
}

export async function latestAnalysis(run: number, actor: string) {
  await ensureAiSchema();
  await q("update ai_analyses set status = 'failed', error = 'Analyse interrompue ; vous pouvez réessayer.' where run_id = $1 and actor = $2 and status = 'pending' and created_at < now() - interval '2 minutes'", [run, actor]);
  return q1<AnalysisRow>("select * from ai_analyses where run_id = $1 and actor = $2 order by id desc limit 1", [run, actor]);
}

/** Only called by an explicit POST/server action, never a render or GET. */
export async function requestDiagnosis(id: number, actor: string, consent: boolean, previewHash: string, transport?: typeof fetch) {
  if (!consent) throw new UserError("Autorisez explicitement l’envoi du contexte affiché au fournisseur IA.");
  const preview = await diagnosisPreview(id, actor);
  if (preview.hash !== previewHash) throw new UserError("Le contexte ou le fournisseur a changé. Relisez l’aperçu avant de consentir.");
  let config;
  try { config = aiConfig(); } catch (e) { throw new UserError((e as Error).message); }
  await ensureAiSchema();
  // One in-flight call per run/actor. Expire an interrupted server request after two minutes.
  await q("update ai_analyses set status = 'failed', error = 'Analyse interrompue ; vous pouvez réessayer.' where run_id = $1 and actor = $2 and status = 'pending' and created_at < now() - interval '2 minutes'", [id, actor]);
  const row = await q1<AnalysisRow>(`insert into ai_analyses (run_id, actor, fingerprint, provider, model, prompt_version, request)
    values ($1, $2, $3, $4, $5, $6, $7::jsonb) on conflict (run_id, actor) where status = 'pending' do nothing returning *`,
    [id, actor, preview.hash, config.provider, config.model, PROMPT_VERSION, JSON.stringify(preview.context)]);
  if (!row) throw new UserError("Une analyse est déjà en cours pour ce test.");
  await audit(actor, "ai.consented", `analysis:${row.id}`, { run: id, fingerprint: preview.hash, provider: config.provider, model: config.model, prompt: PROMPT_VERSION });
  try {
    const response = await callAi(preview.context, config, transport);
    const checks: Check[] = response.proposed_dsl === null ? [] : await Promise.all(preview.scenarios.map(async s => {
      const result = await rehearse(response.proposed_dsl!, s);
      return { case_id: s.id, passed: result.passed, error: result.error };
    }));
    const status = response.proposed_dsl !== null && checks.length > 0 && checks.every(c => c.passed) ? "ready" : "blocked";
    await q("update ai_analyses set response = $2::jsonb, checks = $3::jsonb, status = $4 where id = $1", [row.id, JSON.stringify(response), JSON.stringify(checks), status]);
    await audit(actor, "ai.completed", `analysis:${row.id}`, { status, response: fingerprint(response), checks });
  } catch (e) {
    // Provider bodies, headers and keys are never persisted or surfaced.
    const error = e instanceof Error ? e.message : "Analyse IA impossible.";
    await q("update ai_analyses set status = 'failed', error = $2 where id = $1", [row.id, error]);
    await audit(actor, "ai.failed", `analysis:${row.id}`, { error });
  }
  return row.id;
}

export async function applyDiagnosis(id: number, actor: string, reviewed: boolean) {
  if (!reviewed) throw new UserError("Confirmez la revue de la proposition et de ses hypothèses.");
  await ensureAiSchema();
  const analysis = await q1<AnalysisRow>("select * from ai_analyses where id = $1 and actor = $2", [id, actor]);
  if (!analysis || analysis.status !== "ready" || !analysis.response?.proposed_dsl) throw new UserError("Aucune proposition IA vérifiée disponible.");
  const preview = await diagnosisPreview(analysis.run_id, actor);
  if (preview.hash !== analysis.fingerprint) throw new UserError("Le contexte, les scénarios ou la version ont changé : relancez l’analyse IA.");
  if (analysis.draft_id) return (await getDraft(analysis.draft_id))!.draft;
  const draft = await createDraft(preview.slug, actor);
  if (draft.dsl.trim() !== preview.base.dsl.trim()) throw new UserError("Vous avez déjà une copie modifiée. Intégrez la proposition manuellement pour conserver votre travail.");
  await saveDraft(draft.id, analysis.response.proposed_dsl, actor);
  await q("update ai_analyses set draft_id = $2 where id = $1", [id, draft.id]);
  await audit(actor, "ai.accepted", `draft:${draft.id}`, { analysis: id, provider: analysis.provider, model: analysis.model, prompt: analysis.prompt_version, context: analysis.fingerprint, response: fingerprint(analysis.response), dsl: fingerprint(analysis.response.proposed_dsl) });
  await testDraft(draft.id, actor);
  return draft;
}
