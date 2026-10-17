import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareTable, DslLine, ExpectedChips, Flash, OriginTag } from "@/components/ui";
import { compile } from "@/lib/dsl";
import { getRun, outcomeOf } from "@/lib/data";
import { CONTRACTS, frDate } from "@/lib/labels";
import { finishRunAction, rerunAction, stepRunAction } from "../../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Test pas à pas" };

export default async function RunPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const data = Number.isInteger(id) ? await getRun(id) : null;
  if (!data || !data.automation) notFound();
  const { run, scenario, automation } = data;
  const state = run.state;

  const compiled = compile(run.dsl);
  const instructions = compiled.ok ? compiled.program.instructions : [];
  const instructionLines = new Set(instructions.filter((i) => i.op !== "jump").map((i) => i.line));
  const total = instructionLines.size;
  const byLine = new Map(state.steps.map((s) => [s.line, s]));
  const currentLine = !state.done ? instructions[state.pc]?.line : undefined;
  const lines = run.dsl.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  const outcome = state.done ? outcomeOf(run) : null;
  const draftMatch = /^copie #(\d+)$/.exec(run.source);
  const backHref = draftMatch ? `/d/${draftMatch[1]}` : `/a/${automation.slug}`;
  const requester = scenario?.ticket.requester;
  const consoleHref = `/demo/console/${encodeURIComponent(run.test_email)}`;

  return (
    <>
      <Link className="back" href={backHref}>← {draftMatch ? "Copie de travail" : automation.title}</Link>
      <p className="eyebrow">
        <span>Test pas à pas</span>
        <span>{run.source}</span>
        <span>{automation.title}</span>
      </p>
      <h1>{scenario?.title ?? "Scénario"}</h1>
      <div className="row" style={{ marginBottom: 24 }}>
        {scenario && <OriginTag origin={scenario.origin} />}
        <a className="tag" href={`/demo/tickets/${run.test_ticket}`} target="_blank" rel="noreferrer">Ticket de test {run.test_ticket} ↗</a>
        {requester && (
          <span className="tag">
            {requester.name} · {CONTRACTS[requester.contract] ?? requester.contract}
            {requester.end_date ? ` · fin le ${frDate(requester.end_date)}` : ""}
          </span>
        )}
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} />

      <div className="split" style={{ marginTop: 16 }}>
        <section>
          <p className="label" style={{ marginBottom: 8 }}>L'automatisation, exécutée telle quelle sur l'app de démo</p>
          <pre className="code">
            {lines.map((text, i) => {
              const n = i + 1;
              const res = byLine.get(n);
              const isInstruction = instructionLines.has(n);
              let cls = "";
              let mark = "";
              if (res) { cls = res.ok ? "okl" : "kol"; mark = res.ok ? "✓" : "✗"; }
              else if (n === currentLine) { cls = "cur"; mark = "▶"; }
              else if (isInstruction && state.done) cls = "skip";
              else if (!isInstruction) cls = "skip";
              return (
                <div key={n}>
                  <div className={`ln ${cls}`}>
                    <span className="num">{n}</span>
                    <span className="mk">{mark}</span>
                    <DslLine text={text} />
                  </div>
                  {res && <div className={`detail ${res.ok ? "" : "ko"}`}>→ {res.detail}</div>}
                </div>
              );
            })}
          </pre>
        </section>

        <section className="stack">
          <div className="card frame on">
            {!state.done ? (
              <>
                <p className="eyebrow"><span>En cours</span><span>{state.steps.length} / {total} étapes</span></p>
                <p className="small" style={{ marginBottom: 14 }}>
                  Chaque clic exécute la ligne marquée ▶ sur l'app de démo, pour de vrai, et affiche son résultat.
                </p>
                <div className="row">
                  <form action={stepRunAction}>
                    <input type="hidden" name="run" value={run.id} />
                    <button className="btn" type="submit">Étape suivante</button>
                  </form>
                  <form action={finishRunAction}>
                    <input type="hidden" name="run" value={run.id} />
                    <button className="btn ghost" type="submit">Tout exécuter</button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <div className={`verdict ${outcome?.passed ? "ok" : "ko"}`}>
                  <strong>
                    {outcome?.error ? "Erreur" : outcome?.passed ? "Réussi" : `${outcome?.failures} écart${(outcome?.failures ?? 0) > 1 ? "s" : ""}`}
                  </strong>
                  <span className="mono small">{state.steps.length} étapes exécutées</span>
                </div>
                {state.error && <p className="notice ko" style={{ marginBottom: 14 }}>{state.error}</p>}
                {run.result && run.result.length > 0 && <CompareTable rows={run.result} />}
                <div className="row" style={{ marginTop: 16 }}>
                  <a className="btn" href={consoleHref} target="_blank" rel="noreferrer">Voir dans la console des permissions ↗</a>
                  <form action={rerunAction}>
                    <input type="hidden" name="run" value={run.id} />
                    <button className="btn ghost" type="submit">Relancer ce test</button>
                  </form>
                </div>
              </>
            )}
          </div>

          {!state.done && scenario && (
            <div className="card">
              <p className="label" style={{ marginBottom: 10 }}>Attendu à la fin</p>
              <ExpectedChips expected={scenario.expected} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
