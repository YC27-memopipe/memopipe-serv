import { diffLines } from "diff";
import Image from "next/image";
import type { ReactNode } from "react";
import type { TestOutcome } from "@/lib/data";
import { frDate, levelLabel, systemLabel, TICKET_STATUS } from "@/lib/labels";
import type { CompareRow, Evidence, Expected } from "@/lib/types";
import { friendlyError } from "@/lib/business-workflow";

/** Logo extrait de log.png, sur fond transparent. */
export function Mark({ size = 32 }: { size?: number }) {
  return <Image src="/brand/memopipe.png" width={size} height={size} alt="" aria-hidden="true" style={{ objectFit: "contain", flexShrink: 0 }} />;
}

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return <p className={`notice ${error ? "ko" : "ok"}`} role={error ? "alert" : "status"}>{error ? friendlyError(error) : ok}</p>;
}

export function Avatar({ user, name }: { user: string; name: string }) {
  return <span className={`avatar ${user}`}>{name.slice(0, 1)}</span>;
}


/** Les attendus d'un scénario en une ligne de texte. */
export function expectedText(expected: Expected): string {
  return Object.entries(expected)
    .map(([key, value]) => {
      if (key === "expires_before") return `expire avant le ${frDate(String(value))}`;
      if (key === "ticket_status") return `ticket ${TICKET_STATUS[String(value)]?.toLowerCase() ?? value}`;
      return `${systemLabel(key)} ${levelLabel(key, String(value)).toLowerCase()}`;
    })
    .join(" · ");
}

export function EvidenceList({ evidence, synthetic = false }: { evidence: Evidence[]; synthetic?: boolean }) {
  if (!evidence.length) return null;
  return (
    <details>
      <summary>{evidence.length} extrait{evidence.length > 1 ? "s" : ""} {synthetic ? "d’exemple" : "de votre activité"}</summary>
      <ul className="evidence">
        {evidence.map((e, i) => (
          <li key={i}>
            <q>{e.quote}</q>
            {e.frame_id !== undefined && !synthetic && (
              <a className="tiny" href={`screenpipe://frame/${e.frame_id}`} title="Ouvrir l’extrait sur votre ordinateur">
                Voir la source ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function OutcomeTag({ outcome }: { outcome: TestOutcome | null | undefined }) {
  if (!outcome) return <span className="tag">—</span>;
  if (outcome.error) return <span className="tag ko" title={friendlyError(outcome.error)}>À vérifier</span>;
  if (outcome.passed) return <span className="tag ok">✓ réussi</span>;
  return <span className="tag ko">✗ {outcome.failures} écart{outcome.failures > 1 ? "s" : ""}</span>;
}

export function CompareTable({ rows }: { rows: CompareRow[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Accès</th><th>Attendu</th><th>Obtenu</th><th className="r"> </th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{r.expected}</td>
              <td>{r.obtained}</td>
              <td className="r"><span className={`mark ${r.ok ? "ok" : "ko"}`}>{r.ok ? "✓" : "✗"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KEYWORDS = new Set(["AUTOMATION", "USAGE", "SET", "DO", "IF", "ELSE", "END"]);
const TOKEN = /("(?:[^"\\]|\\.)*")|(\b[a-z]+\.[a-z_]+\b)(?==|\s|$)|(\b[A-Za-z_]+(?==))/g;

/** Coloration légère d'une ligne de DSL. */
export function DslLine({ text }: { text: string }) {
  const indent = /^\s*/.exec(text)?.[0] ?? "";
  const body = text.slice(indent.length);
  const first = body.split(/\s+/, 1)[0];
  const parts: ReactNode[] = [indent];
  let rest = body;
  if (KEYWORDS.has(first)) {
    parts.push(<span key="kw" className={first === "AUTOMATION" || first === "USAGE" ? "k-head" : "k-kw"}>{first}</span>);
    rest = body.slice(first.length);
  }
  let last = 0;
  let i = 0;
  for (const m of rest.matchAll(TOKEN)) {
    parts.push(rest.slice(last, m.index));
    const cls = m[1] ? "k-str" : m[2] ? "k-act" : "k-arg";
    parts.push(<span key={i++} className={cls}>{m[0]}</span>);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(rest.slice(last));
  return <span className="txt">{parts}</span>;
}

/** Affiche un DSL avec numéros de ligne. */
export function DslView({ dsl }: { dsl: string }) {
  const lines = dsl.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  return (
    <pre className="code">
      {lines.map((line, i) => (
        <div className="ln" key={i}>
          <span className="num">{i + 1}</span>
          <DslLine text={line} />
        </div>
      ))}
    </pre>
  );
}

/** Diff ligne par ligne entre deux versions du DSL. */
export function DiffView({ before, after }: { before: string; after: string }) {
  const norm = (s: string) => s.replace(/\r\n?/g, "\n").replace(/\n*$/, "\n");
  const parts = diffLines(norm(before), norm(after));
  const rows: { kind: "add" | "del" | "same"; text: string; n: number | null }[] = [];
  let n = 0;
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const text of lines) {
      if (part.removed) rows.push({ kind: "del", text, n: null });
      else rows.push({ kind: part.added ? "add" : "same", text, n: ++n });
    }
  }
  const changed = rows.some((r) => r.kind !== "same");
  if (!changed) return <p className="empty">Aucune différence avec la version de base.</p>;
  return (
    <pre className="code">
      {rows.map((r, i) => (
        <div key={i} className={`ln ${r.kind === "same" ? "" : r.kind}`}>
          <span className="num">{r.n ?? ""}</span>
          <DslLine text={r.text} />
        </div>
      ))}
    </pre>
  );
}

