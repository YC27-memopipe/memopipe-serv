import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareTable, EvidenceList, Flash } from "@/components/ui";
import { WorkflowView } from "@/components/workflow";
import { AiDiagnostic } from "@/components/ai-diagnostic";
import { getRun, outcomeOf } from "@/lib/data";
import { friendlyError } from "@/lib/business-workflow";
import { finishRunAction, rerunAction } from "../../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export const metadata = { title: "Résultat de l’essai" };

export default async function RunPage({ params, searchParams }: Props) {
  const id = Number((await params).id), sp = await searchParams;
  const data = Number.isInteger(id) ? await getRun(id) : null;
  if (!data?.automation) notFound();
  const { run, scenario, automation } = data, outcome = run.state.done ? outcomeOf(run) : null;
  const draft = /^copie #(\d+)$/.exec(run.source);
  const back = draft ? "/d/" + draft[1] : "/a/" + automation.slug;
  return <>
    <Link className="back" href={back}>← {draft ? "Ma modification" : automation.title}</Link>
    <div className="head"><h1>{scenario?.title ?? "Résultat de l’essai"}</h1><p className="meta">La procédure a été essayée sur une copie de la demande. Consultez les résultats avant de décider de l’utiliser.</p></div>
    <Flash error={typeof sp.error === "string" ? sp.error : undefined} />
    {!run.state.done ? <section className="block"><h2>Vérifier cette situation</h2><p className="plain">Lancez l’essai pour comparer les résultats de la procédure avec votre référence.</p><form action={finishRunAction}><input type="hidden" name="run" value={id} /><button className="btn">Lancer l’essai</button></form></section> : <>
      <div className={"verdict " + (outcome?.passed ? "ok" : "ko")}><strong>{outcome?.error ? "L’essai n’a pas abouti" : outcome?.passed ? "La procédure convient à cette situation" : String(outcome?.failures) + " différence(s) à examiner"}</strong>
      <form action={rerunAction}><input type="hidden" name="run" value={id} /><button className="btn ghost sm">Refaire l’essai</button></form></div>
      {run.state.error && <p className="notice ko">{friendlyError(run.state.error)}</p>}
      {run.result && run.result.length > 0 && <CompareTable rows={run.result} />}
      {outcome?.passed ? <div className="notice ok"><p>Les résultats correspondent aux attentes pour ce cas.</p><Link href={back}>Revenir à la procédure →</Link></div> : !draft && <AiDiagnostic run={id} slug={automation.slug} />}
    </>}
    <details className="more"><summary>Voir les actions prévues</summary><WorkflowView source={run.dsl} /></details>
    {scenario && scenario.evidence.length > 0 && <div className="more"><EvidenceList evidence={scenario.evidence} synthetic={/fictive/i.test(scenario.origin)} /></div>}
  </>;
}
