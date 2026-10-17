import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DiffView, Flash, OriginTag, OutcomeTag, SectionHead } from "@/components/ui";
import { compile } from "@/lib/dsl";
import { getDraft, userName } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { proposeDraftAction, saveDraftAction, testDraftAction } from "../../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Copie de travail" };

export default async function DraftPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const d = Number.isInteger(id) ? await getDraft(id) : null;
  if (!d) notFound();
  if (d.draft.status !== "draft") redirect(`/c/${id}`);

  const user = await currentUser();
  const mine = d.draft.author === user;
  const compiled = compile(d.draft.dsl);
  const results = d.draft.results;
  const copyPassed = results?.filter((r) => r.copy.passed).length ?? 0;
  const changed = d.draft.dsl.trim() !== d.base.dsl.trim();

  return (
    <>
      <Link className="back" href={`/a/${d.automation.slug}`}>← {d.automation.title}</Link>
      <p className="eyebrow">
        <span>Copie de travail #{id}</span>
        <span>basée sur la v{d.base.number}</span>
        <span>par {userName(d.draft.author)}</span>
      </p>
      <h1>Modifier « {d.automation.title} »</h1>
      <p className="lead">
        Votre copie ne change rien pour l'équipe tant qu'elle n'est pas approuvée par {userName(d.automation.owner)}.
        Testez-la sur tous les scénarios, puis proposez-la.
      </p>

      {!mine && <p className="notice wait">Cette copie appartient à {userName(d.draft.author)} : vous pouvez la lire, pas la modifier.</p>}
      {d.stale && <p className="notice wait">Une nouvelle version a été publiée depuis la création de cette copie. Repartez de la version courante.</p>}
      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      <div className="split" style={{ marginTop: 20 }}>
        <section>
          <form action={saveDraftAction}>
            <input type="hidden" name="draft" value={id} />
            <label className="field">
              <span>Automatisation</span>
              <textarea className="dsl" name="dsl" defaultValue={d.draft.dsl} readOnly={!mine} spellCheck={false} />
            </label>
            <div className="row between">
              {compiled.ok ? (
                <span className="tag ok">✓ compile · {compiled.program.instructions.filter((i) => i.op !== "jump").length} instructions</span>
              ) : (
                <span className="tag ko">✗ {compiled.errors.length} erreur{compiled.errors.length > 1 ? "s" : ""}</span>
              )}
              {mine && (
                <span className="row">
                  <button className="btn ghost" type="submit">Enregistrer</button>
                  <button className="btn" type="submit" formAction={testDraftAction}>Enregistrer et tout tester</button>
                </span>
              )}
            </div>
            {!compiled.ok && (
              <p className="notice ko" style={{ marginTop: 12 }}>
                {compiled.errors.map((e) => `Ligne ${e.line} : ${e.message}`).join("\n")}
              </p>
            )}
          </form>

          <details className="card" style={{ marginTop: 18 }}>
            <summary>Aide-mémoire du langage</summary>
            <pre className="code" style={{ fontSize: 12 }}>
              {[
                `SET p = ticket.requester`,
                `IF p.contract == "prestataire"`,
                `  DO iam.grant user=p.email system="github" level="read" expires=p.end_date`,
                `ELSE`,
                `  DO iam.grant user=p.email system="github" level="write"`,
                `END`,
                `DO tickets.comment id=ticket.id text="Accès attribués ({{p.contract}})."`,
                `DO tickets.close id=ticket.id`,
              ].map((l, i) => (
                <div className="ln" key={i}><span className="num">{i + 1}</span><span className="txt">{l}</span></div>
              ))}
            </pre>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Systèmes : github (none, read, write) · vpn-prod (none, access) · slack (none, guest, member).
              Conditions : <span className="mono">==</span>, <span className="mono">!=</span>, <span className="mono">not</span>,{" "}
              <span className="mono">and</span>, <span className="mono">or</span>.
            </p>
          </details>
        </section>

        <section className="stack">
          <div className="card" id="tests">
            <SectionHead title="Tests" />
            {!results ? (
              <p className="empty">Lancez « Enregistrer et tout tester » : chaque scénario s'exécute sur la v{d.base.number} et sur votre copie.</p>
            ) : (
              <>
                <div className={`verdict ${copyPassed === results.length ? "ok" : "ko"}`}>
                  <strong>{copyPassed} / {results.length} sur la copie</strong>
                  <span className="mono small">v{d.base.number} : {results.filter((r) => r.base?.passed).length} / {results.length}</span>
                </div>
                <table className="table">
                  <thead><tr><th>Scénario</th><th>v{d.base.number}</th><th>Copie</th></tr></thead>
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

          <div className="card">
            <SectionHead title="Modifications" />
            <DiffView before={d.base.dsl} after={d.draft.dsl} />
          </div>

          {mine && (
            <form className="card" id="proposer" action={proposeDraftAction}>
              <SectionHead title={`Proposer à ${userName(d.automation.owner)}`} />
              <input type="hidden" name="draft" value={id} />
              <label className="field">
                <span>Pourquoi cette modification ?</span>
                <textarea name="reason" placeholder="Les prestataires recevaient le profil standard : VPN production, GitHub en écriture, sans expiration." />
              </label>
              <div className="row between">
                <span className="tiny muted">{results ? "Les résultats des tests sont joints à la contribution." : "Testez d'abord la copie."}</span>
                <button className="btn" type="submit" disabled={!results || !changed || !compiled.ok}>Proposer</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
