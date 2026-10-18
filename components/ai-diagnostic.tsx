import { SubmitButton, PendingRefresh } from "./live";
import { WorkflowChanges, WorkflowView } from "./workflow";
import { expectedText } from "./ui";
import { diagnosisPreview, latestAnalysis } from "@/lib/ai-diagnosis";
import { businessText, friendlyError } from "@/lib/business-workflow";
import { CONTRACTS } from "@/lib/labels";
import { currentUser } from "@/lib/session";
import { applyAdaptationAction, createDraftAction, diagnoseAction } from "@/app/(hub)/actions";

export async function AiDiagnostic({ run, slug }: { run: number; slug: string }) {
  const actor = await currentUser();
  let preview;
  try { preview = await diagnosisPreview(run, actor); }
  catch (e) { return <section className="block"><h2>Comprendre les différences</h2><p>{friendlyError((e as Error).message)}</p></section>; }
  const analysis = await latestAnalysis(run, actor), response = analysis?.response;
  const stale = !!analysis && analysis.fingerprint !== preview.hash;
  const provider = preview.settings.provider.includes("api.openai.com") || preview.settings.provider === "OpenAI" ? "OpenAI" : new URL(preview.settings.provider).hostname;
  return <section className="block diagnosis" id="diagnostic-ia">
    <h2>Comprendre et adapter</h2><p>L’assistant peut expliquer les différences et suggérer une adaptation. Vous gardez la décision sur les règles à utiliser.</p>
    {!preview.settings.configured && <p className="notice wait">L’assistant n’est pas encore disponible dans votre espace. Contactez votre référent pour activer cette connexion.</p>}
    <details className="more"><summary>Quelles informations seront utilisées ?</summary>
      <p>Le service {provider} recevra les règles de cette procédure, la demande concernée, les résultats de l’essai et les situations de référence. Les noms et adresses reconnus sont masqués ; vérifiez les extraits de texte avant de donner votre accord.</p>
      <h3>Procédure examinée</h3><WorkflowView source={preview.context.automation.dsl} />
      <h3>Situation concernée</h3><p>{CONTRACTS[preview.context.failure.input.requester.contract] ?? preview.context.failure.input.requester.contract} · {expectedText(preview.context.failure.expected)}</p>
      {preview.context.evidence.length > 0 && <><h3>Extraits sélectionnés</h3>{preview.context.evidence.map(e => <blockquote className="quote" key={e.id}>{e.quote}</blockquote>)}</>}
      <p>{preview.context.regression_cases.length} situation(s) de référence seront prises en compte.</p>
      <a className="linkish tiny" download="informations-analyse.json" href={"data:application/json;base64," + Buffer.from(JSON.stringify(preview.context, null, 2)).toString("base64")}>Télécharger l’ensemble des informations transmises</a>
    </details>
    <form action={diagnoseAction}><input type="hidden" name="run" value={run} /><input type="hidden" name="context_hash" value={preview.hash} />
      <label className="consent"><input type="checkbox" name="consent" value="yes" required disabled={!preview.settings.configured} /><span>J’autorise le partage de ces informations avec {provider} pour expliquer cet essai et proposer une adaptation.</span></label>
      <SubmitButton disabled={!preview.settings.configured || analysis?.status === "pending"} pending="L’assistant examine votre situation…">{analysis ? "Demander une nouvelle suggestion" : "Expliquer les différences"}</SubmitButton>
    </form>
    {analysis && <div className="more">
      {stale && <p className="notice wait">La procédure ou les situations ont changé. Demandez une nouvelle suggestion avant de continuer.</p>}
      {analysis.status === "pending" && <><PendingRefresh /><p>L’assistant examine votre situation…</p></>}
      {analysis.error && <p className="notice ko">{friendlyError(analysis.error)}</p>}
      {response && <>
        <h3>Ce que l’assistant a identifié</h3><p>{businessText(response.summary)}</p>
        <ul>{response.causes.map((cause, i) => <li key={i}><strong>{cause.kind === "hypothesis" ? "À confirmer : " : ""}</strong>{businessText(cause.explanation)}
          {cause.evidence_ids.map(id => <blockquote className="quote" key={id}>{analysis.request.evidence.find(e => e.id === id)?.quote}</blockquote>)}
        </li>)}</ul>
        {response.open_questions.length > 0 && <><h3>Points à confirmer</h3><ul>{response.open_questions.map((q, i) => <li key={i}>{businessText(q)}</li>)}</ul></>}
        <p>{businessText(response.change_explanation)}</p>
        {response.proposed_dsl && <>
          <details className="more" open><summary>Les changements proposés</summary><WorkflowChanges before={analysis.request.automation.dsl} after={response.proposed_dsl} /></details>
          <p className={"notice " + (analysis.status === "ready" ? "ok" : "wait")}>{analysis.checks?.filter(c => c.passed).length ?? 0} / {analysis.checks?.length ?? 0} situations conformes lors de la première vérification. Les autres situations restent à examiner avant un usage plus large.</p>
          {analysis.checks?.some(c => !c.passed) && <p className="notice wait">Cette suggestion ne respecte pas encore toutes les situations. Elle doit être ajustée avant de pouvoir être utilisée.</p>}
          {analysis.status === "ready" && !stale && <form action={applyAdaptationAction}><input type="hidden" name="run" value={run} /><input type="hidden" name="analysis" value={analysis.id} />
            <label className="consent"><input type="checkbox" name="reviewed" value="yes" required /><span>J’ai examiné les changements et les points à confirmer. Ces règles correspondent aux situations que je souhaite couvrir.</span></label>
            <SubmitButton pending="Vérification de l’adaptation…">Vérifier cette adaptation</SubmitButton>
          </form>}
        </>}
      </>}
    </div>}
    <form action={createDraftAction} style={{ marginTop: 18 }}><input type="hidden" name="slug" value={slug} /><button className="btn ghost">Adapter les règles moi-même</button></form>
  </section>;
}
