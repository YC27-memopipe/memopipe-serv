import Link from "next/link";
import { listAutomations, listContributions, userName } from "@/lib/data";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Contributions" };

const STATUS = {
  proposed: { label: "En attente", cls: "wait" },
  approved: { label: "Approuvée", cls: "ok" },
  rejected: { label: "Refusée", cls: "ko" },
  draft: { label: "Copie", cls: "" },
} as const;

export default async function ContributionsPage() {
  const [user, contributions, automations] = await Promise.all([currentUser(), listContributions(), listAutomations()]);
  const owners = new Map(automations.map((a) => [a.id, a.owner]));
  const mustDecide = (c: (typeof contributions)[number]) => c.status === "proposed" && owners.get(c.automation_id) === user && c.author !== user;
  const sorted = [...contributions].sort((a, b) => Number(mustDecide(b)) - Number(mustDecide(a)));

  return (
    <>
      <div className="head">
        <h1>Contributions</h1>
        <p className="meta">Les améliorations proposées par l'équipe. Le propriétaire de l'automatisation décide.</p>
      </div>

      {sorted.length === 0 ? (
        <p className="empty">Aucune contribution pour l'instant.</p>
      ) : (
        <div className="list">
          {sorted.map((c) => {
            const passed = c.results?.filter((r) => r.copy.passed).length ?? 0;
            return (
              <Link key={c.id} href={`/c/${c.id}`} className="item">
                <div>
                  <div className="t">{c.reason || c.title}</div>
                  <div className="s">{c.title} · {userName(c.author)} · tests {passed} / {c.results?.length ?? 0}</div>
                </div>
                <div className="r">
                  {mustDecide(c) ? (
                    <span className="tag wait">À vous de décider</span>
                  ) : (
                    <span className={`tag ${STATUS[c.status].cls}`}>
                      {STATUS[c.status].label}{c.status === "approved" && c.published_version ? ` · v${c.published_version}` : ""}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
