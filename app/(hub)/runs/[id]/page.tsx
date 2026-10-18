import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareTable, DslLine, EvidenceList, expectedText, Flash } from "@/components/ui";
import { compile } from "@/lib/dsl";
import { getRun, outcomeOf } from "@/lib/data";
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
  const consoleHref = `/demo/console/${encodeURIComponent(run.test_email)}`;
  const pct = total ? Math.round((state.steps.length / total) * 100) : 0;

  return (
    <>
      <Link className="back" href={backHref}>← {draftMatch ? "Copie de travail" : automation.title}</Link>
      <div className="head">
        <h1>{scenario?.title ?? "Scénario"}</h1>
        <p className="meta">
          {run.source} · sur une copie isolée du ticket,{" "}
          <a href={`/demo/tickets/${run.test_ticket}`} target="_blank" rel="noreferrer">{run.test_ticket} ↗</a>
        </p>
      </div>

      <Flash error={typeof sp.error === "string" ? sp.error : undefined} />

      {!state.done ? (
        <div className="progress">
          <span className="small">{state.steps.length} / {total} étapes</span>
          <div className="bar"><span style={{ width: `${pct}%` }} /></div>
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
        </div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          <div className={`verdict ${outcome?.passed ? "ok" : "ko"}`}>
            <strong>
              {outcome?.error ? "Erreur" : outcome?.passed ? "Réussi" : `${outcome?.failures} écart${(outcome?.failures ?? 0) > 1 ? "s" : ""}`}
            </strong>
            <span className="row">
              <a className="btn ghost sm" href={consoleHref} target="_blank" rel="noreferrer">Console ↗</a>
              <form action={rerunAction}>
                <input type="hidden" name="run" value={run.id} />
                <button className="btn ghost sm" type="submit">Relancer</button>
              </form>
            </span>
          </div>
          {state.error && <p className="notice ko" style={{ marginBottom: 14 }}>{state.error}</p>}
          {run.result && run.result.length > 0 && <CompareTable rows={run.result} />}
        </div>
      )}

      <pre className="code">
        {lines.map((text, i) => {
          const n = i + 1;
          const res = byLine.get(n);
          let cls = "";
          let mark = "";
          if (res) { cls = res.ok ? "okl" : "kol"; mark = res.ok ? "✓" : "✗"; }
          else if (n === currentLine) { cls = "cur"; mark = "▶"; }
          else if (!instructionLines.has(n) || state.done) cls = "skip";
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

      {!state.done && scenario && <p className="plain" style={{ marginTop: 12 }}>Attendu à la fin : {expectedText(scenario.expected)}</p>}
      {scenario && scenario.evidence.length > 0 && <div className="more"><EvidenceList evidence={scenario.evidence} /></div>}
    </>
  );
}
