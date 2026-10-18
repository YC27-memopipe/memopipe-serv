import { cookies } from "next/headers";
import Link from "next/link";
import { SwitchToast } from "@/components/live";
import { Avatar, Mark } from "@/components/ui";
import { isUser, listAutomations, listContributions, USERS } from "@/lib/data";
import { currentUser, SWITCH_COOKIE } from "@/lib/session";
import { setUserAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const [user, contributions, automations, jar] = await Promise.all([
    currentUser(), listContributions(), listAutomations(), cookies(),
  ]);
  const pending = contributions.filter((c) => c.status === "proposed").length;
  const switched = jar.get(SWITCH_COOKIE)?.value;
  const switchedTo = switched?.split(".")[0];
  const owns = automations.some((a) => a.owner === user);

  return (
    <>
      <header className="topbar" data-user={user}>
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="memopipe, accueil">
            <Mark />
            <span className="brand-name">memopipe</span>
          </Link>
          <nav className="nav" aria-label="Navigation principale">
            <Link href="/">Catalogue</Link>
            <Link href="/decouvrir">Mes recommandations</Link>
            <Link href="/contributions">
              À valider {pending > 0 && <span className="count" title={`${pending} en attente`}>{pending}</span>}
            </Link>
            <Link href="/equipe">Équipe</Link>
          </nav>
          <details className="menu">
            <summary aria-label="Changer d'utilisateur">
              <Avatar user={user} name={USERS[user]} />
              <span className="menu-name">{USERS[user]}</span> ▾
            </summary>
            <form action={setUserAction} className="menu-panel">
              <p>Espace de travail</p>
              {Object.entries(USERS).map(([id, name]) => (
                <button key={id} type="submit" name="user" value={id} aria-pressed={user === id}>{name}</button>
              ))}
            </form>
          </details>
        </div>
      </header>
      {switched && switchedTo === user && isUser(switchedTo) && (
        <SwitchToast key={switched} cookie={SWITCH_COOKIE}>
          <Avatar user={user} name={USERS[user]} />
          <span>
            Vous êtes maintenant <strong>{USERS[user]}</strong>
            {owns ? ", propriétaire de l'automatisation" : ", membre de l'équipe"}
          </span>
        </SwitchToast>
      )}
      <main className="page narrow">{children}</main>
    </>
  );
}
