import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioForm } from "@/components/forms";
import { LiveRefresh } from "@/components/live";
import { DslView, expectedText, Flash, OutcomeTag } from "@/components/ui";
import { batchResults, getAutomation, userName } from "@/lib/data";
import { frDateTime } from "@/lib/labels";
import { SCENARIO_EXAMPLE } from "@/lib/seed";
import { currentUser, demoMode, hubOrigin } from "@/lib/session";
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
  const [user, origin, demo] = await Promise.all([currentUser(), hubOrigin(), demoMode()]);
  const hasScreenpipeCase = scenarios.some((s) => /screenpipe/i.test(s.origin));
  const tab = sp.tab === "code" || sp.tab === "historique" ? sp.tab : "tests";
  const batch = typeof sp.batch === "string" ? await batchResults(automation.id, sp.batch) : null;
  const passed = batch?.filter((b) => b.outcome.passed).length ?? 0;
  const myDraft = drafts.find((x) => x.author === user && x.status === "draft" && x.base_version === current.id);
  const contributions = drafts.filter((x) => x.status !== "draft" || x.author === user);
  const tabHref = (t: string) => `/a/${slug}${t === "tests" ? "" : `?tab=${t}`}`;

  return (
    <>
      <LiveRefresh />
      <Link className="back" href="/">← Automatisations</Link>
      <div className="head">
        <h1>{automation.title}</h1>
        <p className="meta">
          v{current.number} · {userName(automation.owner)}{automation.owner === user ? " (vous)" : ""} · {automation.usage}
        </p>
        <div className="actions">
          <form action={testVersionAction}>
            <input type="hidden" name="slug" value={slug} />
            <button className="btn" type="submit" disabled={!scenarios.length}>Tout tester</button>
          </form>
          {myDraft ? (
            <Link className="btn ghost" href={`/d/${myDraft.id}`}>Reprendre ma copie</Link>
          ) : (
            <form action={createDraftAction}>
              <input type="hidden" name="slug" value={slug} />
              <button className="btn ghost" type="submit">Modifier</button>
            </form>
          )}
        </div>
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      <nav className="tabs" aria-label="Sections">
        <Link href={tabHref("tests")} aria-current={tab === "tests" ? "page" : undefined}>Tests ({scenarios.length})</Link>
        <Link href={tabHref("code")} aria-current={tab === "code" ? "page" : undefined}>Code</Link>
        <Link href={tabHref("historique")} aria-current={tab === "historique" ? "page" : undefined}>Historique</Link>
      </nav>

      {tab === "tests" && (
        <section id="resultats">
          {batch && (
            <div className={`verdict ${passed === batch.length ? "ok" : "ko"}`}>
              <strong>{passed} / {batch.length} réussis</strong>
              <span className="mono small">{batch[0]?.source}</span>
            </div>
          )}
          {scenarios.length === 0 ? (
            <p className="empty">Aucun test. Ajoutez-en un, ou importez vos cas depuis Screenpipe.</p>
          ) : (
            <div className="list">
              {scenarios.map((s) => {
                const result = batch?.find((b) => b.scenarioId === s.id);
                const fromScreenpipe = /screenpipe/i.test(s.origin);
                return (
                  <div key={s.id} className="item">
                    <div>
                      <div className="t">
                        {s.title} {fromScreenpipe && <span className="tag sp" title={s.origin}>◉ Screenpipe</span>}
                      </div>
                      <div className="s">{expectedText(s.expected)}</div>
                    </div>
                    <div className="r">
                      {result && <Link href={`/runs/${result.outcome.runId}`}><OutcomeTag outcome={result.outcome} /></Link>}
                      <form action={startRunAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="scenario" value={s.id} />
                        <button className="btn ghost sm" type="submit">Pas à pas</button>
                      </form>
                      {(s.added_by === user || automation.owner === user) && (
                        <form action={deleteScenarioAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="scenario" value={s.id} />
                          <button className="linkish tiny" type="submit" title="Retirer ce test" aria-label={`Retirer le test ${s.title}`}>×</button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <details className="more">
            <summary>Ajouter un test à la main</summary>
            <ScenarioForm slug={slug} example={JSON.stringify(SCENARIO_EXAMPLE, null, 2)} />
          </details>
          <details className="more" open={demo && !hasScreenpipeCase}>
            <summary>Importer vos cas depuis Screenpipe</summary>
            <p className="plain" style={{ marginBottom: 10 }}>
              Sur votre PC, le script retrouve dans Screenpipe les demandes d'accès que vous avez traitées. Chaque cas validé arrive ici comme test.
            </p>
            <pre className="code" style={{ padding: "10px 14px", fontSize: 12 }}>
              <span className="txt">bun run canary:analyze --hub {origin} --automation {slug}</span>
            </pre>
          </details>
        </section>
      )}

      {tab === "code" && (
        <section>
          <p className="plain" style={{ marginBottom: 10 }}>
            v{current.number} par {userName(current.author)}
            {current.approved_by ? `, approuvée par ${userName(current.approved_by)}` : ""} · {frDateTime(current.created_at)}
          </p>
          <DslView dsl={current.dsl} />
        </section>
      )}

      {tab === "historique" && (
        <section>
          <div className="list">
            {versions.map((v) => (
              <div key={v.id} className="item">
                <div>
                  <div className="t">v{v.number} · {v.note || "—"}</div>
                  <div className="s">
                    {userName(v.author)}{v.approved_by ? `, approuvée par ${userName(v.approved_by)}` : ""} · {frDateTime(v.created_at)}
                  </div>
                </div>
                <div className="r">{v.id === current.id && <span className="tag dark">courante</span>}</div>
              </div>
            ))}
          </div>

          <div className="block">
            <h2>Contributions</h2>
            {contributions.length === 0 ? (
              <p className="plain">Aucune contribution. Cliquez sur « Modifier » pour en proposer une.</p>
            ) : (
              <div className="list">
                {contributions.map((c) => (
                  <Link key={c.id} href={c.status === "draft" ? `/d/${c.id}` : `/c/${c.id}`} className="item">
                    <div>
                      <div className="t">{c.reason || "Copie de travail"}</div>
                      <div className="s">{userName(c.author)} · #{c.id}</div>
                    </div>
                    <div className="r">
                      <span className={`tag ${STATUS[c.status].cls}`}>
                        {STATUS[c.status].label}{c.status === "approved" && c.published_version ? ` · v${c.published_version}` : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
