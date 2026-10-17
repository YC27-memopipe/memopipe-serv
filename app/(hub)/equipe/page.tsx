import Link from "next/link";
import { Avatar, Flash, SectionHead } from "@/components/ui";
import { listAutomations, listContributions, USERS } from "@/lib/data";
import { currentUser, hubOrigin } from "@/lib/session";
import { resetAction } from "../actions";

export const metadata = { title: "Équipe" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const EXAMPLE = `{
  "automation": "attribuer-acces",
  "title": "Prestataire externe, mission de 3 mois",
  "origin": "Screenpipe · Bob · T-1182",
  "added_by": "bob",
  "ticket": { "id": "T-1182", "type": "access_request",
    "requester": { "name": "Inès Fabre", "email": "ines.fabre@presta.example",
                   "contract": "prestataire", "team": "data", "end_date": "2027-01-15" } },
  "expected": { "github": "read", "vpn-prod": "none", "slack": "guest",
                "expires_before": "2027-01-15", "ticket_status": "done" },
  "evidence": [ { "frame_id": 51234, "quote": "GitHub : Lecture seule" } ]
}`;

export default async function TeamPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [user, origin, automations, contributions] = await Promise.all([currentUser(), hubOrigin(), listAutomations(), listContributions()]);
  const tokenRequired = !!process.env.MEMOPIPE_TEAM_TOKEN;

  return (
    <>
      <p className="eyebrow"><span>Équipe</span><span>Nimbus IT</span></p>
      <h1>L'équipe</h1>
      <p className="lead">
        Pour le prototype, pas de compte : choisissez qui vous êtes en haut à droite. Chacun branche son propre Screenpipe ;
        les captures restent sur son PC, seuls les scénarios validés arrivent ici.
      </p>
      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      <div className="grid" style={{ marginTop: 8 }}>
        {Object.entries(USERS).map(([id, name]) => {
          const owned = automations.filter((a) => a.owner === id);
          const authored = contributions.filter((c) => c.author === id);
          return (
            <div key={id} className={`card ${id === user ? "frame on" : ""}`}>
              <div className="row">
                <Avatar user={id} name={name} />
                <div>
                  <h3>{name}{id === user ? " (vous)" : ""}</h3>
                  <p className="tiny muted">{owned.length ? `Propriétaire de ${owned.length} automatisation${owned.length > 1 ? "s" : ""}` : "Membre"}</p>
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 12 }}>
                {authored.length} contribution{authored.length > 1 ? "s" : ""} · {authored.filter((c) => c.status === "approved").length} approuvée
                {authored.filter((c) => c.status === "approved").length > 1 ? "s" : ""}
              </p>
            </div>
          );
        })}
      </div>

      <section className="section split even">
        <div>
          <SectionHead title="Brancher Screenpipe" />
          <p className="small" style={{ marginBottom: 12 }}>
            Sur le PC qui a l'historique, dans le dépôt du script <span className="mono">memopipe:analyze</span> :
          </p>
          <pre className="code" style={{ padding: "12px 16px", fontSize: 12 }}>
            {[
              `# .env`,
              `SCREENPIPE_LOCAL_API_KEY=...   # screenpipe auth token`,
              `MEMOPIPE_HUB_URL=${origin}`,
              `MEMOPIPE_TEAM_TOKEN=${tokenRequired ? "<jeton de l'équipe>" : "(pas de jeton exigé ici)"}`,
              ``,
              `bun run memopipe:analyze --hub ${origin} --automation attribuer-acces`,
            ].map((l, i) => (
              <div className="ln" key={i}><span className="txt">{l}</span></div>
            ))}
          </pre>
          <p className="small muted" style={{ marginTop: 12 }}>
            Le script lit Screenpipe en local, montre chaque cas retrouvé, demande votre validation, puis envoie les scénarios validés à{" "}
            <span className="mono">POST /api/scenarios</span>.
          </p>
        </div>
        <div>
          <SectionHead title="Format attendu par le hub" />
          <pre className="code" style={{ padding: "12px 16px", fontSize: 12 }}>
            {EXAMPLE.split("\n").map((l, i) => (
              <div className="ln" key={i}><span className="txt">{l}</span></div>
            ))}
          </pre>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            En-tête {tokenRequired ? "obligatoire" : "facultatif ici"} : <span className="mono">Authorization: Bearer &lt;MEMOPIPE_TEAM_TOKEN&gt;</span>
          </p>
        </div>
      </section>

      <section className="section">
        <SectionHead title="Préparer la démo" />
        <div className="grid">
          <form action={resetAction} className="card">
            <input type="hidden" name="scope" value="demo" />
            <h3>Réinitialiser l'app de démo</h3>
            <p className="small muted" style={{ margin: "6px 0 14px" }}>
              Remet les tickets T-1175, T-1182 et T-1201 à « Ouvert » et vide la console des permissions. Le catalogue ne change pas.
            </p>
            <button className="btn ghost sm" type="submit">Réinitialiser l'app de démo</button>
          </form>
          <form action={resetAction} className="card">
            <input type="hidden" name="scope" value="all" />
            <h3>Tout réinitialiser</h3>
            <p className="small muted" style={{ margin: "6px 0 14px" }}>
              Repart d'un catalogue avec la seule v1 d'Alice et son scénario CDI. Efface les scénarios, tests et contributions.
            </p>
            <button className="btn danger sm" type="submit">Tout réinitialiser</button>
          </form>
          <div className="card">
            <h3>App de démo Nimbus IT</h3>
            <p className="small muted" style={{ margin: "6px 0 14px" }}>
              Les tickets et la console sur lesquels Bob travaille pendant que Screenpipe enregistre.
            </p>
            <Link className="btn ghost sm" href="/demo/tickets" target="_blank">Ouvrir Nimbus IT ↗</Link>
          </div>
        </div>
      </section>
    </>
  );
}
