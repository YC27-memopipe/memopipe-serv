import { demoProgress, isUser, USERS, type UserId } from "@/lib/data";
import { setUserAction } from "./actions";

type Step = { label: string; actor: UserId; href: string; done: boolean };

/** Le fil de la démo : quatre étapes, qui joue chacune, et un clic pour y aller avec le bon utilisateur. */
export async function DemoBar() {
  const p = await demoProgress();
  if (!p) return null;
  const fiche = `/a/${p.slug}`;
  const owner: UserId = isUser(p.owner) ? p.owner : "alice";
  const proposed = p.draft && (p.draft.status === "proposed" || p.draft.status === "approved") ? p.draft : null;
  const steps: Step[] = [
    { label: "Bob importe ses cas Screenpipe", actor: "bob", href: fiche, done: !!p.scenario },
    { label: "Bob teste la v1", actor: "bob", href: p.run ? `/runs/${p.run}` : fiche, done: !!p.run },
    {
      label: "Bob corrige et propose",
      actor: "bob",
      href: proposed ? `/c/${proposed.id}` : p.draft?.status === "draft" ? `/d/${p.draft.id}` : fiche,
      done: !!proposed,
    },
    { label: `${USERS[owner]} approuve la v2`, actor: owner, href: proposed ? `/c/${proposed.id}` : fiche, done: proposed?.status === "approved" },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <nav className="demobar" aria-label="Étapes de la démo">
      <ol className="demobar-inner">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? "done" : i === current ? "cur" : ""}>
            <form action={setUserAction}>
              <input type="hidden" name="user" value={s.actor} />
              <input type="hidden" name="next" value={s.href} />
              <button type="submit" title={`Aller à cette étape en tant que ${USERS[s.actor]}`} aria-current={i === current ? "step" : undefined}>
                <span className={`avatar ${s.actor}`}>{s.done ? "✓" : USERS[s.actor].slice(0, 1)}</span>
                {s.label}
              </button>
            </form>
          </li>
        ))}
      </ol>
    </nav>
  );
}
