import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash, OutcomeTag } from "@/components/ui";
import { WorkflowChanges, WorkflowFields } from "@/components/workflow";
import { DraftAudit } from "@/components/draft-audit";
import { getDraft, userName } from "@/lib/data";
import { fingerprint } from "@/lib/audit";
import { currentUser } from "@/lib/session";
import { proposeDraftAction, saveBusinessDraftAction, testBusinessDraftAction } from "../../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export const metadata = { title: "Adapter une procédure" };

export default async function DraftPage({ params, searchParams }: Props) {
  const id = Number((await params).id), sp = await searchParams;
  const d = Number.isInteger(id) ? await getDraft(id) : null;
  if (!d) notFound(); if (d.draft.status !== "draft") redirect("/c/" + id);
  const mine = d.draft.author === await currentUser();
  const results = d.draft.results, changed = d.draft.dsl.trim() !== d.base.dsl.trim();
  const allPass = !!results?.length && results.every(r => r.copy.passed);
  return <>
    <Link className="back" href={"/a/" + d.automation.slug}>← {d.automation.title}</Link>
    <div className="head"><h1>{mine ? "Adapter la procédure" : "Modification de " + userName(d.draft.author)}</h1><p className="meta">Ajustez les règles, vérifiez les résultats, puis demandez la validation de {userName(d.automation.owner)}.</p></div>
    <div className="journey"><span>1. Comprendre</span><span className="active">2. Adapter et vérifier</span><span>3. Faire valider</span></div>
    {!mine && <p className="notice wait">Cette modification est en lecture seule.</p>}
    {d.stale && <p className="notice wait">Une nouvelle version est disponible. Repartez de cette version avant de proposer une modification.</p>}
    <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />
    <form action={saveBusinessDraftAction}><input type="hidden" name="draft" value={id} /><input type="hidden" name="revision" value={fingerprint(d.draft.dsl)} /><WorkflowFields source={d.draft.dsl} readOnly={!mine} />
      {mine && <div className="actions"><button className="btn" formAction={testBusinessDraftAction}>Enregistrer et vérifier</button><button className="btn ghost">Enregistrer</button></div>}
    </form>
    {changed && <details className="more"><summary>Ce qui change pour l’équipe</summary><WorkflowChanges before={d.base.dsl} after={d.draft.dsl} /></details>}
    <section className="block" id="tests"><h2>Résultats des vérifications</h2>{!results ? <p className="plain">Vérifiez votre modification sur toutes les situations de référence avant de la proposer.</p> : <>
      <div className={"verdict " + (allPass ? "ok" : "ko")}><strong>{results.filter(r => r.copy.passed).length} / {results.length} cas conformes</strong></div>
      <div className="list">{results.map(r => <div className="item" key={r.scenarioId}><div className="t">{r.title}</div><div className="r"><span className="tiny muted">Avant</span>{r.base && <Link href={"/runs/" + r.base.runId}><OutcomeTag outcome={r.base} /></Link>}<span className="tiny muted">Avec la modification</span><Link href={"/runs/" + r.copy.runId}><OutcomeTag outcome={r.copy} /></Link></div></div>)}</div>
    </>}</section>
    {mine && <form className="block" id="proposer" action={proposeDraftAction}><h2>Demander la validation de {userName(d.automation.owner)}</h2><input type="hidden" name="draft" value={id} /><label className="field"><span>Pourquoi cette modification est-elle utile ?</span><textarea name="reason" required placeholder="Expliquez le besoin et les situations couvertes…" defaultValue={d.draft.reason} /></label><p className="tiny muted">Les résultats des vérifications seront joints à votre demande.</p><button className="btn" disabled={!allPass || !changed || d.stale}>Envoyer pour validation</button></form>}
    <DraftAudit id={id} />
  </>;
}
