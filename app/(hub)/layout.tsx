import Link from "next/link";
import { Mark } from "@/components/ui";
import { listContributions, USERS } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { setUserAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const [user, contributions] = await Promise.all([currentUser(), listContributions()]);
  const pending = contributions.filter((c) => c.status === "proposed").length;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="memopipe, accueil">
            <Mark />
            <span className="brand-name">memopipe</span>
            <span className="brand-sub">/ powered by screenpipe</span>
          </Link>
          <nav className="nav" aria-label="Navigation principale">
            <Link href="/">Catalogue</Link>
            <Link href="/contributions">
              Contributions {pending > 0 && <span className="count" title={`${pending} en attente`}>{pending}</span>}
            </Link>
            <Link href="/equipe">Équipe</Link>
            <a href="/demo/tickets" target="_blank" rel="noreferrer">Nimbus IT ↗</a>
          </nav>
          <form action={setUserAction} className="who">
            <span className="who-label">Je suis</span>
            <span className="segmented">
              {Object.entries(USERS).map(([id, name]) => (
                <button key={id} type="submit" name="user" value={id} aria-pressed={user === id}>{name}</button>
              ))}
            </span>
          </form>
        </div>
      </header>
      <main className="page">
        {children}
        <footer className="foot">
          <span>memopipe · partager, tester et améliorer les automatisations de l'équipe</span>
          <span>Prototype hackathon Screenpipe · données fictives</span>
        </footer>
      </main>
    </>
  );
}
