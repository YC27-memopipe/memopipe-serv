import Link from "next/link";
import { Avatar, Flash } from "@/components/ui";
import { agentStatus, listAutomations, listContributions, USERS } from "@/lib/data";
import { frDateTime } from "@/lib/labels";
import { currentUser, demoMode, hubOrigin } from "@/lib/session";
import { prepareDemoAction, resetAction, toggleDemoAction } from "../actions";

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

function Code({ lines }: { lines: string[] }) {
  return (
    <pre className="code" style={{ padding: "12px 16px", fontSize: 12 }}>
      {lines.map((l, i) => <div className="ln" key={i}><span className="txt">{l}</span></div>)}
    </pre>
  );
}

export default async function TeamPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [user, origin, automations, contributions, agent, demo] = await Promise.all([
    currentUser(), hubOrigin(), listAutomations(), listContributions(), agentStatus(), demoMode(),
  ]);
  const tokenRequired = !!process.env.MEMOPIPE_TEAM_TOKEN;
  const token = tokenRequired ? "<MEMOPIPE_TEAM_TOKEN du hub>" : "(pas de jeton exigé ici)";

  return (
    <>
      <div className="head">
        <h1>Équipe</h1>
        <p className="meta">Pas de compte pour le prototype : choisissez qui vous êtes en haut à droite.</p>
      </div>
      <Flash error={typeof sp.error === "string" ? sp.error : undefined} ok={typeof sp.ok === "string" ? sp.ok : undefined} />

      <div className="list">
        {Object.entries(USERS).map(([id, name]) => {
          const owned = automations.filter((a) => a.owner === id).length;
          const authored = contributions.filter((c) => c.author === id);
          const approved = authored.filter((c) => c.status === "approved").length;
          return (
            <div key={id} className="item">
              <div className="row">
                <Avatar user={id} name={name} />
                <div>
                  <div className="t">{name}{id === user ? " (vous)" : ""}</div>
                  <div className="s">
                    {owned ? `propriétaire de ${owned} automatisation${owned > 1 ? "s" : ""} · ` : ""}
                    {authored.length} contribution{authored.length > 1 ? "s" : ""}, {approved} approuvée{approved > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="block" id="agent">
        <h2>Screenpipe</h2>
        <div className="list">
          <div className="item">
            <div>
              <div className="t">Agent local · Gmail</div>
              <div className="s">Exécute pour de vrai gmail.search et gmail.send sur le PC qui a Screenpipe.</div>
            </div>
            <div className="r">
              <span className={`tag ${agent.online ? "ok" : ""}`}>
                <span className="dot" />
                {agent.online ? "en ligne" : agent.lastSeen ? `vu le ${frDateTime(agent.lastSeen)}` : "jamais connecté"}
              </span>
            </div>
          </div>
        </div>

        <details className="more">
          <summary>Lancer l'agent local</summary>
          <p className="plain" style={{ marginBottom: 10 }}>
            Le hub ne peut pas joindre Screenpipe : il met les actions Gmail en file d'attente, l'agent les exécute et renvoie le résultat.
            La lecture passe par la connexion IMAP de Screenpipe, l'envoi par son navigateur.
          </p>
          <Code lines={[
            `# .env du dépôt memopipe-local`,
            `SCREENPIPE_LOCAL_API_KEY=...   # screenpipe auth token`,
            `CANARY_HUB_URL=${origin}`,
            `CANARY_TEAM_TOKEN=${token}`,
            `CANARY_TEST_INBOX=vous@gmail.com   # tous les envois arrivent ici`,
            ``,
            `bun run canary:agent`,
          ]} />
        </details>
        <details className="more">
          <summary>Importer des tests depuis son historique</summary>
          <p className="plain" style={{ marginBottom: 10 }}>
            Le script retrouve dans Screenpipe les cas déjà traités. Les captures restent sur le PC : seuls les cas validés arrivent ici.
          </p>
          <Code lines={[
            `# .env du dépôt memopipe-local`,
            `SCREENPIPE_LOCAL_API_KEY=...`,
            `CANARY_HUB_URL=${origin}`,
            `CANARY_TEAM_TOKEN=${token}`,
            ``,
            `bun run canary:analyze --hub ${origin} --automation attribuer-acces`,
          ]} />
        </details>
        <details className="more">
          <summary>Format envoyé à POST /api/scenarios</summary>
          <Code lines={EXAMPLE.split("\n")} />
          <p className="tiny muted" style={{ marginTop: 8 }}>
            En-tête {tokenRequired ? "obligatoire" : "facultatif ici"} : <span className="mono">Authorization: Bearer &lt;MEMOPIPE_TEAM_TOKEN&gt;</span>
          </p>
        </details>
      </section>

      <section className="block">
        <h2>Démo</h2>
        <div className="list">
          <form action={prepareDemoAction} className="item">
            <div>
              <div className="t">Préparer la démo</div>
              <div className="s">Repart de la v1 d'Alice et de son test CDI, vous connecte en Bob et affiche le fil des 4 étapes.</div>
            </div>
            <div className="r"><button className="btn sm" type="submit">Préparer</button></div>
          </form>
          <form action={toggleDemoAction} className="item">
            <input type="hidden" name="on" value={demo ? "0" : "1"} />
            <div>
              <div className="t">Fil de la démo</div>
              <div className="s">{demo ? "Affiché sous la barre du haut." : "Masqué."}</div>
            </div>
            <div className="r"><button className="btn ghost sm" type="submit">{demo ? "Masquer" : "Afficher"}</button></div>
          </form>
          <div className="item">
            <div>
              <div className="t">App de démo Nimbus IT</div>
              <div className="s">Les tickets et la console sur lesquels Bob travaille pendant que Screenpipe enregistre.</div>
            </div>
            <div className="r"><Link className="btn ghost sm" href="/demo/tickets" target="_blank">Ouvrir ↗</Link></div>
          </div>
          <form action={resetAction} className="item">
            <input type="hidden" name="scope" value="demo" />
            <div>
              <div className="t">Réinitialiser l'app de démo</div>
              <div className="s">Tickets à « Ouvert », console vide. Le catalogue ne change pas.</div>
            </div>
            <div className="r"><button className="btn ghost sm" type="submit">Réinitialiser</button></div>
          </form>
        </div>
      </section>
    </>
  );
}
