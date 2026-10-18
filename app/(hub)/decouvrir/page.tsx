import Link from "next/link";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/live";
import { recentDiscoveries } from "@/lib/discoveries";
import { currentUser } from "@/lib/session";
import { userName } from "@/lib/data";
import { frDateTime } from "@/lib/labels";
import { discoverAction } from "../actions";

export const metadata = { title: "Mes recommandations" };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser();
  const [history, sp] = await Promise.all([recentDiscoveries(user), searchParams]);
  return <>
    <div className="head"><p className="eyebrow">Gagner du temps au quotidien</p><h1>Trouvez une procédure pour votre travail</h1><p className="meta">{userName(user)}, retrouvez les procédures de votre équipe qui correspondent aux tâches que vous effectuez déjà.</p></div>
    <Flash error={typeof sp.error === "string" ? sp.error : undefined} />
    <div className="journey" aria-label="Les étapes"><span className="active">1. Analyser mon activité</span><span>2. Essayer une procédure</span><span>3. Adapter et partager</span></div>
    <section className="discovery-intro"><h2>Quelles tâches souhaitez-vous simplifier ?</h2><p>Nous recherchons dans votre activité récente les demandes d’accès et les permissions que vous avez enregistrées dans Nimbus. Les procédures correspondantes vous seront proposées automatiquement.</p>
      <form action={discoverAction} className="discovery-form">
        <label className="field">Période à examiner<select name="since" defaultValue="24h"><option value="30m">30 dernières minutes</option><option value="24h">24 dernières heures</option><option value="2d">2 derniers jours</option></select></label>
        <label className="consent"><input type="checkbox" name="consent" value="yes" required /><span>J’autorise l’analyse de mon activité Nimbus sur cette période et le partage des informations utiles avec cet espace. Les captures complètes restent sur mon ordinateur. Je vérifierai chaque situation avant de l’utiliser comme référence.</span></label>
        <SubmitButton pending="Recherche des procédures adaptées…">Trouver mes procédures</SubmitButton>
      </form><p className="tiny muted">Screenpipe doit être ouvert sur votre ordinateur. Une activité insuffisante peut ne donner aucune recommandation.</p>
    </section>
    <section className="block"><h2>Mes analyses récentes</h2>{!history.length ? <p className="empty">Vos recommandations apparaîtront ici après votre première analyse.</p> : <div className="list">{history.map(d => <Link className="item" key={d.id} href={"/decouvrir/" + d.id}><div><div className="t">Analyse du {frDateTime(d.created_at)}</div><div className="s">{d.report?.cases.length ?? "…"} situation(s) retrouvée(s) · {d.recommendations?.length ?? "…"} procédure(s) proposée(s)</div></div><span className={"tag " + (d.status === "error" ? "ko" : d.status === "done" ? "ok" : "wait")}>{d.status === "pending" ? "En cours" : d.status === "done" ? "Terminée" : "À réessayer"}</span></Link>)}</div>}</section>
  </>;
}
