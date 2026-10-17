import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar, DiffView, Flash, OriginTag, OutcomeTag, SectionHead } from "@/components/ui";
import { getDraft, userName } from "@/lib/data";
import { frDateTime } from "@/lib/labels";
import { currentUser } from "@/lib/session";
import { approveAction, commentAction, rejectAction } from "../../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Contribution" };

export default async function ContributionPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const d = Number.isInteger(id) ? await getDraft(id) : null;
  if (!d) notFound();
  const user = await currentUser();
  if (d.draft.status === "draft") {
    if (d.draft.author === user) redirect(`/d/${id}`);
    notFound();
  }

  const { draft, automation, base, comments } = d;
  const results = draft.results ?? [];
  const allPass = results.length > 0 && results.every((r) => r.copy.passed);
  const isOwner = automation.owner === user;
  const canDecide = draft.status === "proposed" && isOwner && draft.author !== user;
  const status =
    draft.status === "proposed" ? { label: "En attente de décision", cls: "wait" }
    : draft.status === "approved" ? { label: `Approuvée · publiée en v${draft.published_version ?? "?"}`, cls: "ok" }
    : { label: "Refusée", cls: "ko" };

  return (
    <>
      <Link className="back" href={`/a/${automation.slug}`}>← {automation.title}</Link>
      <p className="eyebrow">
        <span>Contribution #{id}</span>
        <span>basée sur la v{base.number}</span>
        <span>par {userName(draft.author)}</span>
        {draft.proposed_at && <span>{frDateTime(draft.proposed_at)}</span>}
      </p>
      <h1>{automation.title}</h1>
      <div className="row" style={{ marginBottom: 24 }}>
        <span className={`tag ${status.cls}`}><span className="dot" />{status.label}</span>
        <span className="tag">propriétaire : {userName(automation.owner)}</span>
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      <div className="split" style={{ marginTop: 16 }}>
        <section className="stack">
          <div>
            <p className="label" style={{ marginBottom: 8 }}>Pourquoi</p>
            <blockquote className="quote">{draft.reason}</blockquote>
          </div>
          <div>
            <SectionHead title="Modifications">
              <span className="tiny muted">v{base.number} → copie de {userName(draft.author)}</span>
            </SectionHead>
            <DiffView before={base.dsl} after={draft.dsl} />
          </div>
        </section>

        <section className="stack">
          <div className="card">
            <SectionHead title="Résultats des tests" />
            {results.length === 0 ? (
              <p className="empty">Aucun résultat joint.</p>
            ) : (
              <>
                <div className={`verdict ${allPass ? "ok" : "ko"}`}>
                  <strong>{results.filter((r) => r.copy.passed).length} / {results.length} sur la copie</strong>
                  <span className="mono small">v{base.number} : {results.filter((r) => r.base?.passed).length} / {results.length}</span>
                </div>
                <table className="table">
                  <thead><tr><th>Scénario</th><th>v{base.number}</th><th>Contribution</th></tr></thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.scenarioId}>
                        <td>{r.title}<div style={{ marginTop: 4 }}><OriginTag origin={r.origin} /></div></td>
                        <td>{r.base ? <Link href={`/runs/${r.base.runId}`}><OutcomeTag outcome={r.base} /></Link> : <OutcomeTag outcome={null} />}</td>
                        <td><Link href={`/runs/${r.copy.runId}`}><OutcomeTag outcome={r.copy} /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="card frame on">
            <SectionHead title="Décision" />
            {draft.status === "approved" && (
              <p className="notice ok">
                Approuvée par {userName(draft.decided_by)} le {frDateTime(draft.decided_at!)} : la v{draft.published_version} est
                la version courante pour toute l'équipe.
              </p>
            )}
            {draft.status === "rejected" && <p className="notice ko">Refusée par {userName(draft.decided_by)} le {frDateTime(draft.decided_at!)}.</p>}
            {draft.status === "proposed" && d.stale && (
              <p className="notice wait">Une autre version a été publiée depuis : cette contribution est obsolète et ne peut plus être approuvée.</p>
            )}
            {draft.status === "proposed" && !canDecide && !d.stale && (
              <p className="notice">
                En attente de la décision de {userName(automation.owner)}, propriétaire de l'automatisation.
                {draft.author === user ? " L'auteur d'une contribution ne peut pas l'approuver." : ""}
              </p>
            )}
            {canDecide && !d.stale && (
              <>
                <p className="small muted" style={{ marginBottom: 12 }}>
                  À l'approbation, memopipe relance tous les scénarios sur la contribution. La nouvelle version n'est publiée que s'ils réussissent tous.
                </p>
                <div className="row">
                  <form action={approveAction}>
                    <input type="hidden" name="draft" value={id} />
                    <button className="btn" type="submit" disabled={!allPass}>Approuver et publier la v{base.number + 1}</button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="draft" value={id} />
                    <button className="btn danger" type="submit">Refuser</button>
                  </form>
                </div>
                {!allPass && <p className="tiny muted" style={{ marginTop: 8 }}>Un scénario échoue sur la contribution : l'approbation est bloquée.</p>}
              </>
            )}
          </div>

          <div className="card" id="discussion">
            <SectionHead title="Discussion" />
            {comments.length > 0 && (
              <ul className="comments">
                {comments.map((c) => (
                  <li key={c.id}>
                    <Avatar user={c.author} name={userName(c.author)} />
                    <div className="bubble">
                      <span className="who">{userName(c.author)} · {frDateTime(c.created_at)}</span>
                      {c.body}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form action={commentAction}>
              <input type="hidden" name="draft" value={id} />
              <label className="field">
                <span>Commenter en tant que {userName(user)}</span>
                <textarea name="body" placeholder="Une question, un cas à vérifier…" />
              </label>
              <div className="row end"><button className="btn ghost sm" type="submit">Envoyer</button></div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
