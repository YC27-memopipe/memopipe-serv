import Link from "next/link";

export const dynamic = "force-dynamic";

function NimbusMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#2f5fa8" />
      <path d="M7 15.5a3 3 0 0 1 .6-5.9 4.2 4.2 0 0 1 8 1.1A2.4 2.4 0 1 1 17 15.5Z" fill="#fff" />
    </svg>
  );
}

// Outil interne fictif de Nimbus, sur lequel les automatisations agissent et que Screenpipe observe.
export default function NimbusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nimbus">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/nimbus/tickets" className="brand">
            <NimbusMark />
            <span className="brand-name">Nimbus IT</span>
            <span className="brand-sub">outil interne</span>
          </Link>
          <nav className="nav">
            <Link href="/nimbus/tickets">Tickets</Link>
            
            <Link href="/">memopipe ↗</Link>
          </nav>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
