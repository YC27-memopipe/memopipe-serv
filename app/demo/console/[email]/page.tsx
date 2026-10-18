import type { Metadata } from "next";
import Link from "next/link";
import { getConsole } from "@/lib/data";
import { CONTRACTS, frDate, frDateTime, levelLabel, SYSTEM_IDS, SYSTEMS } from "@/lib/labels";
import { saveConsoleAction } from "../../actions";

type Props = {
  params: Promise<{ email: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Le titre « Console des permissions · <email> » et le résumé en texte simple sont lus par canary:analyze.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const email = decodeURIComponent((await params).email);
  return { title: { absolute: `Console des permissions · ${email}` } };
}

export default async function ConsolePage({ params, searchParams }: Props) {
  const email = decodeURIComponent((await params).email);
  const sp = await searchParams;
  const c = await getConsole(email);
  const level = (system: string) => c.grants.find((g) => g.system === system)?.level ?? "none";
  const expires = c.grants.find((g) => g.expires)?.expires ?? "";

  return (
    <>
      <Link className="back" href={c.ticketId ? `/demo/tickets/${c.ticketId}` : "/demo/tickets"}>← {c.ticketId ?? "Tickets"}</Link>
      <h1>Console des permissions</h1>
      <p className="muted" style={{ marginTop: -6, marginBottom: 24 }}>
        {c.person ? `${c.person.name} · ${CONTRACTS[c.person.contract] ?? c.person.contract} · ` : ""}{email}
        {c.ticketId ? ` · Ticket ${c.ticketId}` : ""}
      </p>
      {typeof sp.error === "string" && <p className="notice ko" style={{ marginBottom: 16 }}>{sp.error}</p>}

      <div className="split even">
        <form action={saveConsoleAction} className="card">
          <input type="hidden" name="email" value={email} />
          <h2 style={{ marginBottom: 16 }}>Accès</h2>
          <div className="perm">
            {SYSTEM_IDS.map((system) => (
              <label key={system} className="field">
                <span>{SYSTEMS[system].label}</span>
                <select name={system} defaultValue={level(system)}>
                  {Object.entries(SYSTEMS[system].levels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="field">
              <span>Expiration</span>
              <input type="date" name="expires" defaultValue={expires} />
            </label>
          </div>
          <div className="row end"><button className="btn" type="submit">Enregistrer</button></div>
        </form>

        <div className="card summary" aria-live="polite">
          {c.savedAt ? (
            <>
              {/* Une ligne = une seule chaîne de texte, pour que Screenpipe la capture d'un bloc. */}
              <p className="saved">{`Modifications enregistrées le ${frDateTime(c.savedAt)}`}</p>
              {SYSTEM_IDS.map((system) => (
                <p key={system}>{`${SYSTEMS[system].label} : ${levelLabel(system, level(system))}`}</p>
              ))}
              <p>{`Expiration : ${expires ? frDate(expires) : "Aucune"}`}</p>
            </>
          ) : (
            <p className="muted">Aucune modification enregistrée pour cette personne.</p>
          )}
        </div>
      </div>
    </>
  );
}
