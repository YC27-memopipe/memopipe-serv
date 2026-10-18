import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DiffView, Flash, OutcomeTag } from "@/components/ui";
import { compile } from "@/lib/dsl";
import { getDraft, userName } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { proposeDraftAction, saveDraftAction, testDraftAction } from "../../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Copie de travail" };

const CHEATSHEET = [
  `SET p = ticket.requester`,
  `IF p.contract == "prestataire"`,
  `  DO iam.grant user=p.email system="github" level="read" expires=p.end_date`,
  `ELSE`,
  `  DO iam.grant user=p.email system="github" level="write"`,
  `END`,
  `DO tickets.comment id=ticket.id text="Accès attribués ({{p.contract}})."`,
  `DO tickets.close id=ticket.id`,
  `DO gmail.search query="{{p.name}}" limit="3" -> mails`,
  `IF mails.first.snippet contains "pas de VPN"`,
  `  DO tickets.comment id=ticket.id text="Consigne lue dans Gmail : {{mails.first.subject}}"`,
  `END`,
  `DO gmail.send to=p.email subject="Vos accès Nimbus" body="Bonjour {{p.name}}, vos accès sont prêts."`,
];

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
      <div className="head">
        <h1>{mine ? "Ma copie" : `Copie de ${userName(d.draft.author)}`}</h1>
        <p className="meta">
          Basée sur la v{d.base.number}. Rien ne change pour l'équipe tant que {userName(d.automation.owner)} n'a pas approuvé.
        </p>
      </div>

      {!mine && <p className="notice wait">Lecture seule : cette copie appartient à {userName(d.draft.author)}.</p>}
      {d.stale && <p className="notice wait">Une nouvelle version a été publiée depuis. Repartez de la version courante.</p>}
      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      <form action={saveDraftAction}>
        <input type="hidden" name="draft" value={id} />
        <textarea className="dsl" name="dsl" aria-label="Automatisation" defaultValue={d.draft.dsl} readOnly={!mine} spellCheck={false} />
        <div className="row between" style={{ marginTop: 10 }}>
          {compiled.ok ? (
            <span className="tag ok">✓ compile</span>
          ) : (
            <span className="tag ko">✗ {compiled.errors.length} erreur{compiled.errors.length > 1 ? "s" : ""}</span>
          )}
          {mine && (
            <span className="row">
              <button className="btn ghost" type="submit">Enregistrer</button>
              <button className="btn" type="submit" formAction={testDraftAction}>Enregistrer et tester</button>
            </span>
          )}
        </div>
        {!compiled.ok && (
          <p className="notice ko" style={{ marginTop: 12 }}>
            {compiled.errors.map((e) => `Ligne ${e.line} : ${e.message}`).join("\n")}
          </p>
        )}
      </form>

      <details className="more">
        <summary>Aide-mémoire du langage</summary>
        <pre className="code" style={{ fontSize: 12 }}>
          {CHEATSHEET.map((l, i) => (
            <div className="ln" key={i}><span className="num">{i + 1}</span><span className="txt">{l}</span></div>
          ))}
        </pre>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Systèmes : github (none, read, write) · vpn-prod (none, access) · slack (none, guest, member). Conditions :{" "}
          <span className="mono">==</span>, <span className="mono">!=</span>, <span className="mono">contains</span>, <span className="mono">not</span>,{" "}
          <span className="mono">and</span>, <span className="mono">or</span>. Les actions <span className="mono">gmail.*</span> sont réelles :
          l'agent local les exécute via Screenpipe.
        </p>
      </details>
      {changed && (
        <details className="more">
          <summary>Voir les modifications</summary>
          <DiffView before={d.base.dsl} after={d.draft.dsl} />
        </details>
      )}

      <section className="block" id="tests">
        <h2>Tests</h2>
        {!results ? (
          <p className="plain">« Enregistrer et tester » exécute chaque test sur la v{d.base.number} et sur votre copie.</p>
        ) : (
          <>
            <div className={`verdict ${copyPassed === results.length ? "ok" : "ko"}`}>
              <strong>{copyPassed} / {results.length} réussis</strong>
              <span className="mono small">v{d.base.number} : {results.filter((r) => r.base?.passed).length} / {results.length}</span>
            </div>
            <div className="list">
              {results.map((r) => (
                <div key={r.scenarioId} className="item">
                  <div className="t">{r.title}</div>
                  <div className="r">
                    <span className="tiny muted">v{d.base.number}</span>
                    {r.base ? <Link href={`/runs/${r.base.runId}`}><OutcomeTag outcome={r.base} /></Link> : <OutcomeTag outcome={null} />}
                    <span className="tiny muted">copie</span>
                    <Link href={`/runs/${r.copy.runId}`}><OutcomeTag outcome={r.copy} /></Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {mine && (
        <form className="block" id="proposer" action={proposeDraftAction}>
          <h2>Proposer à {userName(d.automation.owner)}</h2>
          <input type="hidden" name="draft" value={id} />
          <textarea
            name="reason"
            aria-label="Pourquoi cette modification ?"
            placeholder="Pourquoi ? Ex. : les prestataires recevaient le profil standard, sans expiration."
          />
          <div className="row between" style={{ marginTop: 10 }}>
            <span className="tiny muted">{results ? "Les résultats des tests sont joints." : "Testez d'abord la copie."}</span>
            <button className="btn" type="submit" disabled={!results || !changed || !compiled.ok}>Proposer</button>
          </div>
        </form>
      )}
    </>
  );
}
