import Link from "next/link";
import { Flash } from "@/components/ui";
import { listAutomations, userName } from "@/lib/data";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CatalogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const automations = await listAutomations();

  return (
    <>
      <div className="head">
        <h1>Les procédures de votre équipe</h1>
        <p className="meta">Retrouvez les bonnes pratiques de vos collègues, essayez-les sur vos situations et adaptez-les ensemble.</p>
        <div className="actions">
          <Link className="btn" href="/decouvrir">Trouver une procédure pour moi</Link>
          <Link className="btn ghost" href="/a/new">Partager une procédure</Link>
        </div>
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      {automations.length === 0 ? (
        <p className="empty">Votre équipe n’a pas encore partagé de procédure.</p>
      ) : (
        <div className="list">
          {automations.map((a) => (
            <Link key={a.id} href={`/a/${a.slug}`} className="item">
              <div>
                <div className="t">{a.title}</div>
                <div className="s">Version {a.version ?? 1} · {userName(a.owner)} · {a.scenarios} situation(s) de référence</div>
              </div>
              <div className="r">
                {a.open > 0 && <span className="tag wait">{a.open} à examiner</span>}
                <span className="faint">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
