import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar, Flash, OutcomeTag } from "@/components/ui";
import { WorkflowChanges } from "@/components/workflow";
import { getDraft, userName } from "@/lib/data";
import { frDateTime } from "@/lib/labels";
import { currentUser } from "@/lib/session";
import { DraftAudit } from "@/components/draft-audit";
import { approveAction, commentAction, rejectAction } from "../../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Validation d’une amélioration" };

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
  const canDecide = draft.status === "proposed" && automation.owner === user && draft.author !== user;
  const status =
    draft.status === "proposed" ? { label: "En attente", cls: "wait" }
    : draft.status === "approved" ? { label: `Approuvée · v${draft.published_version ?? "?"}`, cls: "ok" }
    : { label: "Refusée", cls: "ko" };

  return (
    <>
      <Link className="back" href={`/a/${automation.slug}`}>← {automation.title}</Link>
      <div className="head">
        <h1>Amélioration proposée par {userName(draft.author)}</h1>
        <p className="meta">
          <span className={`tag ${status.cls}`}>{status.label}</span> {automation.title} · depuis la v{base.number}
          {draft.proposed_at ? ` · ${frDateTime(draft.proposed_at)}` : ""}
        </p>
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      <blockquote className="quote">{draft.reason}</blockquote>
      <DraftAudit id={id} />

      <section className="block">
        {results.length === 0 ? (
          <p className="plain">Aucun résultat de test joint.</p>
        ) : (
          <>
            <div className={`verdict ${allPass ? "ok" : "ko"}`}>
              <strong>{results.filter((r) => r.copy.passed).length} / {results.length} tests réussis</strong>
              <span className="mono small">v{base.number} : {results.filter((r) => r.base?.passed).length} / {results.length}</span>
            </div>
            <details className="more" style={{ marginTop: 0 }}>
              <summary>Détail par test</summary>
              <div className="list">
                {results.map((r) => (
                  <div key={r.scenarioId} className="item">
                    <div className="t">{r.title}</div>
                    <div className="r">
                      <span className="tiny muted">v{base.number}</span>
                      {r.base ? <Link href={`/runs/${r.base.runId}`}><OutcomeTag outcome={r.base} /></Link> : <OutcomeTag outcome={null} />}
                      <span className="tiny muted">contribution</span>
                      <Link href={`/runs/${r.copy.runId}`}><OutcomeTag outcome={r.copy} /></Link>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </section>

      <section className="block">
        {draft.status === "approved" && (
          <p className="notice ok">
            Approuvée par {userName(draft.decided_by)} le {frDateTime(draft.decided_at!)} : la v{draft.published_version} est la version de toute l'équipe.
          </p>
        )}
        {draft.status === "rejected" && <p className="notice ko">Refusée par {userName(draft.decided_by)} le {frDateTime(draft.decided_at!)}.</p>}
        {draft.status === "proposed" && d.stale && (
          <p className="notice wait">Une autre version a été publiée depuis : cette contribution ne peut plus être approuvée.</p>
        )}
        {draft.status === "proposed" && !canDecide && !d.stale && (draft.author === user && automation.owner !== user ? (
          <div className="handoff">
            <p>
              C'est à <strong>{userName(automation.owner)}</strong>, propriétaire, de décider : l'auteur d'une contribution ne peut pas l'approuver.
            </p>
          </div>
        ) : (
          <p className="plain">En attente de la décision de {userName(automation.owner)}.</p>
        ))}
        {canDecide && !d.stale && (
          <>
            <div className="row">
              <form action={approveAction}>
                <input type="hidden" name="draft" value={id} />
                <button className="btn" type="submit" disabled={!allPass}>Approuver et publier la v{base.number + 1}</button>
              </form>
              <form action={rejectAction}>
                <input type="hidden" name="draft" value={id} />
                <button className="btn ghost" type="submit">Refuser</button>
              </form>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              {allPass
                ? "Les tests sont relancés à l'approbation : la version n'est publiée que s'ils réussissent tous."
                : "Un test échoue sur la contribution : l'approbation est bloquée."}
            </p>
          </>
        )}
      </section>

      <section className="block">
        <h2>Modifications</h2>
        <WorkflowChanges before={base.dsl} after={draft.dsl} />
      </section>

      <section className="block" id="discussion">
        <h2>Discussion</h2>
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
          <textarea name="body" aria-label={`Commenter en tant que ${userName(user)}`} placeholder="Une question, un cas à vérifier…" />
          <div className="row end" style={{ marginTop: 8 }}><button className="btn ghost sm" type="submit">Commenter</button></div>
        </form>
      </section>
    </>
  );
}
