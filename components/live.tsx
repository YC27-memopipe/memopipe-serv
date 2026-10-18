"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Met la page à jour quand le hub change, par exemple quand le script Screenpipe envoie un scénario. */
export function LiveRefresh({ every = 2000 }: { every?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { v } = await (await fetch("/api/pulse", { cache: "no-store" })).json();
        if (last.current !== null && v !== last.current) router.refresh();
        last.current = v;
      } catch {}
    };
    tick();
    const timer = setInterval(tick, every);
    return () => clearInterval(timer);
  }, [router, every]);
  return null;
}

/** Annonce le changement d'utilisateur, une seule fois. */
export function SwitchToast({ cookie, children }: { cookie: string; children: React.ReactNode }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    document.cookie = `${cookie}=; path=/; max-age=0`;
    const timer = setTimeout(() => setShown(false), 3200);
    return () => clearTimeout(timer);
  }, [cookie]);
  if (!shown) return null;
  return <div className="toast" role="status">{children}</div>;
}
