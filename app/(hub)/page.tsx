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
        <h1>Automatisations</h1>
        <p className="meta">Testez celles de vos collègues sur vos propres cas, puis proposez vos corrections.</p>
        <div className="actions">
          <Link className="btn" href="/a/new">Nouvelle automatisation</Link>
        </div>
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      {automations.length === 0 ? (
        <p className="empty">Aucune automatisation pour l'instant.</p>
      ) : (
        <div className="list">
          {automations.map((a) => (
            <Link key={a.id} href={`/a/${a.slug}`} className="item">
              <div>
                <div className="t">{a.title}</div>
                <div className="s">v{a.version ?? 1} · {userName(a.owner)} · {a.scenarios} test{a.scenarios > 1 ? "s" : ""}</div>
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
