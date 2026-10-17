import Link from "next/link";
import { Flash, SectionHead } from "@/components/ui";
import { listAutomations, userName } from "@/lib/data";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CatalogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const automations = await listAutomations();

  return (
    <>
      <p className="eyebrow"><span>Catalogue de l'équipe</span><span>Nimbus IT</span></p>
      <h1>Des automatisations qui apprennent<br />de toute l'équipe.</h1>
      <p className="lead">
        Avant de réutiliser l'automatisation d'un collègue, testez-la sur les cas réels de votre historique Screenpipe.
        Corrigez-la, proposez votre correction : la nouvelle version profite à tout le monde.
      </p>

      <div className="flow">
        <div><span className="n">01</span><b>Récupérer</b><p>Une automatisation publiée par un collègue.</p></div>
        <div><span className="n">02</span><b>Tester avec Screenpipe</b><p>Vos cas réels deviennent des scénarios de test.</p></div>
        <div><span className="n">03</span><b>Corriger</b><p>Étape par étape, sur une copie de travail.</p></div>
        <div><span className="n">04</span><b>Proposer</b><p>Le propriétaire approuve, l'équipe récupère la nouvelle version.</p></div>
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      <SectionHead title="Automatisations">
        <Link className="btn ghost sm" href="/a/new">Publier une automatisation</Link>
      </SectionHead>

      {automations.length === 0 ? (
        <p className="empty">Aucune automatisation pour l'instant. Publiez la première.</p>
      ) : (
        <div className="grid">
          {automations.map((a) => (
            <Link key={a.id} href={`/a/${a.slug}`} className="card link frame">
              <p className="eyebrow"><span>v{a.version ?? 1}</span><span>propriétaire : {userName(a.owner)}</span></p>
              <p className="card-title">{a.title}</p>
              <p className="muted small">{a.usage}</p>
              <div className="row" style={{ marginTop: 16 }}>
                <span className="tag">{a.scenarios} scénario{a.scenarios > 1 ? "s" : ""} de test</span>
                {a.version_author && a.version_author !== a.owner && <span className="tag">v{a.version} par {userName(a.version_author)}</span>}
                {a.open > 0 && <span className="tag wait"><span className="dot" />{a.open} contribution{a.open > 1 ? "s" : ""} à examiner</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
