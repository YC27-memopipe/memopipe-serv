import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioForm } from "@/components/forms";
import { LiveRefresh } from "@/components/live";
import { expectedText, Flash, OutcomeTag } from "@/components/ui";
import { WorkflowView } from "@/components/workflow";
import { batchResults, getAutomation, userName } from "@/lib/data";
import { frDateTime } from "@/lib/labels";
import { currentUser } from "@/lib/session";
import { createDraftAction, deleteScenarioAction, startRunAction, testVersionAction } from "../../actions";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getAutomation((await params).slug); return { title: d?.automation.title ?? "Procédure" };
}
const statuses: Record<string, string> = { draft: "En préparation", proposed: "À valider", approved: "Approuvée", rejected: "Refusée" };

export default async function AutomationPage({ params, searchParams }: Props) {
  const { slug } = await params, sp = await searchParams;
  const d = await getAutomation(slug); if (!d) notFound();
  const { automation, current, versions, scenarios, drafts } = d;
  const user = await currentUser();
  const tab = sp.tab === "historique" ? "historique" : sp.tab === "code" || sp.tab === "procedure" ? "procedure" : "tests";
  const batch = typeof sp.batch === "string" ? await batchResults(automation.id, sp.batch) : null;
  const myDraft = drafts.find(x => x.author === user && x.status === "draft" && x.base_version === current.id);
  return <>
    <LiveRefresh /><Link className="back" href="/">← Catalogue</Link>
    <div className="head"><h1>{automation.title}</h1><p className="meta">Version {current.number} · Responsable : {userName(automation.owner)}</p><p>{automation.usage}</p>
      <div className="actions"><form action={testVersionAction}><input type="hidden" name="slug" value={slug} /><button className="btn" disabled={!scenarios.length}>Vérifier tous les cas</button></form>
      {myDraft ? <Link className="btn ghost" href={"/d/" + myDraft.id}>Reprendre ma modification</Link> : <form action={createDraftAction}><input type="hidden" name="slug" value={slug} /><button className="btn ghost">Adapter cette procédure</button></form>}</div>
    </div>
    <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />
    <nav className="tabs" aria-label="Sections"><Link href={"/a/" + slug} aria-current={tab === "tests" ? "page" : undefined}>Cas vérifiés ({scenarios.length})</Link><Link href={"/a/" + slug + "?tab=procedure"} aria-current={tab === "procedure" ? "page" : undefined}>Déroulé de la procédure</Link><Link href={"/a/" + slug + "?tab=historique"} aria-current={tab === "historique" ? "page" : undefined}>Historique</Link></nav>
    {tab === "tests" && <section id="resultats">
      {batch && <div className={"verdict " + (batch.every(b => b.outcome.passed) ? "ok" : "ko")}><strong>{batch.filter(b => b.outcome.passed).length} / {batch.length} cas conformes</strong></div>}
      {!scenarios.length ? <div className="empty"><p>Aucun cas de référence. Retrouvez une situation dans votre activité ou ajoutez-en une.</p><Link href="/decouvrir">Analyser mon activité →</Link></div> : <div className="list">{scenarios.map(s => <div key={s.id} className="item"><div><div className="t">{s.title}</div><div className="s">{expectedText(s.expected)}</div></div><div className="r">
        {batch?.find(b => b.scenarioId === s.id) && <Link href={"/runs/" + batch.find(b => b.scenarioId === s.id)!.outcome.runId}><OutcomeTag outcome={batch.find(b => b.scenarioId === s.id)!.outcome} /></Link>}
        <form action={startRunAction}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="scenario" value={s.id} /><button className="btn ghost sm">Essayer sur ce cas</button></form>
        {(s.added_by === user || automation.owner === user) && <form action={deleteScenarioAction}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="scenario" value={s.id} /><button className="linkish tiny" title="Retirer cette référence" aria-label={"Retirer " + s.title}>Retirer</button></form>}
      </div></div>)}</div>}
      <details className="more"><summary>Ajouter une situation de référence</summary><ScenarioForm slug={slug} /></details>
      <p className="plain"><Link href="/decouvrir">Retrouver d’autres situations dans mon activité →</Link></p>
    </section>}
    {tab === "procedure" && <section><p className="plain">Les informations de chaque demande sont utilisées automatiquement. Voici les actions prévues.</p><WorkflowView source={current.dsl} /></section>}
    {tab === "historique" && <section><div className="list">{versions.map(v => <div className="item" key={v.id}><div><div className="t">Version {v.number} · {v.note || "Procédure partagée"}</div><div className="s">{userName(v.author)}{v.approved_by ? ", validée par " + userName(v.approved_by) : ""} · {frDateTime(v.created_at)}</div></div>{v.id === current.id && <span className="tag ok">En service</span>}</div>)}</div>
      <div className="block"><h2>Améliorations de l’équipe</h2><div className="list">{drafts.filter(c => c.status !== "draft" || c.author === user).map(c => <Link className="item" key={c.id} href={(c.status === "draft" ? "/d/" : "/c/") + c.id}><div><div className="t">{c.reason || "Modification en préparation"}</div><div className="s">{userName(c.author)}</div></div><span className="tag">{statuses[c.status]}</span></Link>)}</div></div>
    </section>}
  </>;
}
