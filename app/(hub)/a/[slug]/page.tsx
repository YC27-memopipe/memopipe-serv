import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioForm } from "@/components/forms";
import { DslView, EvidenceList, ExpectedChips, Flash, OriginTag, OutcomeTag, SectionHead } from "@/components/ui";
import { batchResults, getAutomation, userName } from "@/lib/data";
import { CONTRACTS, frDateTime } from "@/lib/labels";
import { SCENARIO_EXAMPLE } from "@/lib/seed";
import { currentUser, hubOrigin } from "@/lib/session";
import { createDraftAction, deleteScenarioAction, startRunAction, testVersionAction } from "../../actions";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getAutomation(slug);
  return { title: d?.automation.title ?? "Automatisation" };
}

const STATUS = {
  proposed: { label: "En attente", cls: "wait" },
  approved: { label: "Approuvée", cls: "ok" },
  rejected: { label: "Refusée", cls: "ko" },
  draft: { label: "Copie en cours", cls: "" },
} as const;

export default async function AutomationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const d = await getAutomation(slug);
  if (!d) notFound();
  const { automation, current, versions, scenarios, drafts } = d;
  const [user, origin] = await Promise.all([currentUser(), hubOrigin()]);
  const batch = typeof sp.batch === "string" ? await batchResults(automation.id, sp.batch) : null;
  const passed = batch?.filter((b) => b.outcome.passed).length ?? 0;
  const myDraft = drafts.find((x) => x.author === user && x.status === "draft" && x.base_version === current.id);
  const contributions = drafts.filter((x) => x.status !== "draft" || x.author === user);

  return (
    <>
      <Link className="back" href="/">← Catalogue</Link>
      <p className="eyebrow">
        <span>Automatisation</span>
        <span>v{current.number}</span>
        <span>propriétaire : {userName(automation.owner)}</span>
      </p>
      <h1>{automation.title}</h1>
      <p className="lead">{automation.usage}</p>

      <div className="row" style={{ marginBottom: 28 }}>
        {myDraft ? (
          <Link className="btn" href={`/d/${myDraft.id}`}>Reprendre ma copie de travail</Link>
        ) : (
          <form action={createDraftAction}>
            <input type="hidden" name="slug" value={slug} />
            <button className="btn" type="submit">Modifier une copie</button>
          </form>
        )}
        <form action={testVersionAction}>
          <input type="hidden" name="slug" value={slug} />
          <button className="btn ghost" type="submit" disabled={!scenarios.length}>Tout tester la v{current.number}</button>
        </form>
        {user === automation.owner && <span className="tag dark">Vous êtes propriétaire</span>}
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      {batch && (
        <section className="card" id="resultats" style={{ marginBottom: 32 }}>
          <div className={`verdict ${passed === batch.length ? "ok" : "ko"}`}>
            <strong>{passed} / {batch.length} scénarios réussis</strong>
            <span className="mono small">{batch[0]?.source ?? `v${current.number}`}</span>
          </div>
          <table className="table">
            <thead><tr><th>Scénario</th><th>Origine</th><th>Résultat</th><th className="r"> </th></tr></thead>
            <tbody>
              {batch.map((b) => (
                <tr key={b.outcome.runId}>
                  <td>{b.title}</td>
                  <td><OriginTag origin={b.origin} /></td>
                  <td><OutcomeTag outcome={b.outcome} /></td>
                  <td className="r"><Link className="small" href={`/runs/${b.outcome.runId}`}>voir les étapes →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="split">
        <section>
          <SectionHead title={`Version courante · v${current.number}`}>
            <span className="tiny muted">
              par {userName(current.author)}
              {current.approved_by ? `, approuvée par ${userName(current.approved_by)}` : ""} · {frDateTime(current.created_at)}
            </span>
          </SectionHead>
          <DslView dsl={current.dsl} />

          <div className="section">
            <SectionHead title="Historique des versions" />
            <table className="table">
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="mono nowrap">v{v.number}</td>
                    <td>
                      {v.note || "—"}
                      <div className="tiny muted">
                        par {userName(v.author)}
                        {v.approved_by ? ` · approuvée par ${userName(v.approved_by)}` : ""} · {frDateTime(v.created_at)}
                      </div>
                    </td>
                    <td className="r">{v.id === current.id && <span className="tag dark">courante</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="scenarios">
          <SectionHead title="Scénarios de test">
            <span className="tiny muted">{scenarios.length} au total</span>
          </SectionHead>

          <div className="card frame on" style={{ marginBottom: 18 }}>
            <p className="eyebrow"><span>◉ Tester avec mon historique Screenpipe</span></p>
            <p className="small" style={{ marginBottom: 10 }}>
              Sur votre PC, le script retrouve dans Screenpipe les demandes d'accès que vous avez déjà traitées.
              Chaque cas que vous validez arrive ici comme scénario de test.
            </p>
            <pre className="code" style={{ padding: "10px 14px", fontSize: 12 }}>
              <span className="txt">bun run memopipe:analyze --hub {origin} --automation {slug}</span>
            </pre>
          </div>

          <div className="stack">
            {scenarios.length === 0 && <p className="empty">Aucun scénario. Ajoutez-en un, ou lancez l'analyse Screenpipe.</p>}
            {scenarios.map((s) => (
              <article key={s.id} className="card">
                <div className="row between">
                  <h3>{s.title}</h3>
                  <OriginTag origin={s.origin} />
                </div>
                <p className="tiny muted" style={{ margin: "4px 0 10px" }}>
                  {s.ticket.requester.name} · {CONTRACTS[s.ticket.requester.contract] ?? s.ticket.requester.contract}
                  {s.ticket.requester.team ? ` · ${s.ticket.requester.team}` : ""} · ajouté par {userName(s.added_by)}
                </p>
                <ExpectedChips expected={s.expected} />
                <div style={{ marginTop: 10 }}><EvidenceList evidence={s.evidence} /></div>
                <div className="row between" style={{ marginTop: 14 }}>
                  <form action={startRunAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="scenario" value={s.id} />
                    <button className="btn sm" type="submit">Tester pas à pas</button>
                  </form>
                  {(s.added_by === user || automation.owner === user) && (
                    <form action={deleteScenarioAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="scenario" value={s.id} />
                      <button className="linkish tiny" type="submit">retirer</button>
                    </form>
                  )}
                </div>
              </article>
            ))}
            <details className="card">
              <summary>Ajouter un scénario écrit à la main</summary>
              <ScenarioForm slug={slug} example={JSON.stringify(SCENARIO_EXAMPLE, null, 2)} />
            </details>
          </div>
        </section>
      </div>

      <section className="section" id="contributions">
        <SectionHead title="Contributions">
          <Link className="small" href="/contributions">toutes les contributions →</Link>
        </SectionHead>
        {contributions.length === 0 ? (
          <p className="empty">Aucune contribution. Modifiez une copie pour proposer une amélioration.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Auteur</th><th>Raison</th><th>Statut</th><th className="r"> </th></tr></thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">#{c.id}</td>
                    <td>{userName(c.author)}</td>
                    <td>{c.reason || <span className="muted">—</span>}</td>
                    <td>
                      <span className={`tag ${STATUS[c.status].cls}`}>
                        {STATUS[c.status].label}
                        {c.status === "approved" && c.published_version ? ` · v${c.published_version}` : ""}
                      </span>
                    </td>
                    <td className="r">
                      <Link className="small" href={c.status === "draft" ? `/d/${c.id}` : `/c/${c.id}`}>ouvrir →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
