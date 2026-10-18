import Link from "next/link";
import { Avatar } from "@/components/ui";
import { agentStatus, listAutomations, listContributions, USERS } from "@/lib/data";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Équipe" };

export default async function TeamPage() {
  const [user, automations, contributions, connection] = await Promise.all([currentUser(), listAutomations(), listContributions(), agentStatus()]);
  return <>
    <div className="head"><h1>Votre équipe</h1><p className="meta">Des procédures partagées, un responsable pour chaque validation.</p></div>
    <div className="list">{Object.entries(USERS).map(([id, name]) => <div className="item" key={id}>
      <div className="row"><Avatar user={id} name={name} /><div><div className="t">{name}{id === user ? " · votre espace" : ""}</div>
      <div className="s">{automations.filter(a => a.owner === id).length} procédure(s) gérée(s) · {contributions.filter(c => c.author === id && c.status === "approved").length} amélioration(s) publiée(s)</div></div></div>
    </div>)}</div>
    <section className="block"><h2>Votre activité professionnelle</h2>
      <div className="item"><div><div className="t">Connexion à votre ordinateur</div><div className="s">{connection.online ? "Votre ordinateur est connecté. Ouvrez Screenpipe avant de lancer une analyse." : "Ouvrez Screenpipe et vérifiez la connexion de votre ordinateur à cet espace. Si le problème persiste, contactez votre référent."}</div></div>
      <span className={"tag " + (connection.online ? "ok" : "wait")}>{connection.online ? "Connecté" : "À connecter"}</span></div>
      <p className="plain">La lecture de votre activité commence uniquement après votre autorisation. Vous choisissez la période et les situations à utiliser.</p>
      <Link className="btn" href="/decouvrir">Trouver une procédure adaptée</Link>
    </section>
    <section className="block"><h2>Vos outils de travail</h2><p className="plain">Consultez les demandes et gérez les droits des nouveaux arrivants dans Nimbus IT.</p><Link className="btn ghost" href="/nimbus/tickets">Ouvrir Nimbus IT ↗</Link></section>
  </>;
}
