import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceList, expectedText, Flash } from "@/components/ui";
import { PendingRefresh, SubmitButton } from "@/components/live";
import { currentUser } from "@/lib/session";
import { getDiscovery } from "@/lib/discoveries";
import { userName } from "@/lib/data";
import { frDateTime } from "@/lib/labels";
import { acceptRecommendationAction } from "../../actions";

export const metadata = { title: "Vos recommandations" };

export default async function DiscoveryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const id = Number((await params).id), user = await currentUser();
  const d = Number.isSafeInteger(id) ? await getDiscovery(id, user) : null;
  if (!d) notFound();
  const sp = await searchParams;
  return <>
    <Link className="back" href="/decouvrir">← Mes analyses</Link>
    <div className="head"><h1>{d.status === "pending" ? "Nous recherchons les procédures adaptées…" : "Des procédures pour votre travail"}</h1><p className="meta">Votre activité du {frDateTime(d.start_time)} au {frDateTime(d.end_time)}</p></div>
    <div className="journey"><span>1. Analyser mon activité</span><span className="active">2. Essayer une procédure</span><span>3. Adapter et partager</span></div>
    <Flash error={typeof sp.error === "string" ? sp.error : d.error ?? undefined} />
    {d.status === "pending" && <><PendingRefresh /><p className="notice wait" role="status">Nous examinons les informations autorisées sur votre ordinateur. Gardez Screenpipe ouvert ; cette page se met à jour automatiquement.</p></>}
    {d.status === "error" && <Link className="btn" href="/decouvrir">Réessayer l’analyse</Link>}
    {d.report && <>
      {d.report.provenance === "synthetic-demo" && <p className="notice wait">Données d’exemple : ces situations ne proviennent pas de votre activité enregistrée.</p>}
      <p className="plain">{d.report.cases.length} situation(s) retrouvée(s) · {d.recommendations?.length ?? 0} procédure(s) à essayer.</p>
      {d.report.warnings.length > 0 && <p className="notice">Certaines observations sont incomplètes et n’ont pas été retenues comme références.</p>}
      {!d.recommendations?.length && <div className="empty"><h2>Aucune procédure à recommander pour le moment</h2><p>{d.report.cases.length ? "Les situations retrouvées ne correspondent pas encore aux procédures partagées par votre équipe." : "Votre activité ne contient pas encore de situation complète. Traitez une demande et enregistrez ses permissions dans Nimbus pendant que Screenpipe est ouvert, puis relancez l’analyse."}</p><Link className="btn ghost" href="/decouvrir">Faire une nouvelle analyse</Link></div>}
      {d.recommendations?.map(r => <section className="recommendation" key={r.slug}>
        <h2>{r.title}</h2><p className="meta">Partagée par {userName(r.owner)} · Version {r.version}</p>
        <p>Cette procédure intervient sur les mêmes outils que vos demandes. Un essai permettra de vérifier les différences avant de l’utiliser.</p>
        <Link className="linkish" href={"/a/" + r.slug + "?tab=procedure"}>Voir les étapes de la procédure →</Link>
        {r.caseIndexes.map(index => { const s = d.report!.cases[index]; return <article className="observed-case" key={index}>
          <h3>{s.ticket.requester.name}</h3><p>{expectedText(s.expected)}</p><p className="tiny muted">Vérifiez que les droits enregistrés constituent le bon résultat à obtenir et que la demande doit être terminée.</p>
          <EvidenceList evidence={s.evidence ?? []} synthetic={d.report!.provenance === "synthetic-demo"} />
          <form action={acceptRecommendationAction}><input type="hidden" name="discovery" value={d.id} /><input type="hidden" name="slug" value={r.slug} /><input type="hidden" name="case" value={index} />
            <label className="consent"><input type="checkbox" name="confirmed" value="yes" required /><span>Je confirme que cette situation est correcte et peut servir de référence.</span></label>
            <SubmitButton pending="La procédure est essayée sur une copie…">Essayer sur cette situation</SubmitButton>
          </form>
        </article>; })}
      </section>)}
    </>}
  </>;
}
