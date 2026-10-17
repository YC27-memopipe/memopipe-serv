import Link from "next/link";
import { listAutomations, listContributions, userName } from "@/lib/data";
import { frDateTime } from "@/lib/labels";
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
  const toReview = contributions.filter((c) => c.status === "proposed" && owners.get(c.automation_id) === user && c.author !== user);

  return (
    <>
      <p className="eyebrow"><span>Contributions</span><span>améliorations proposées par l'équipe</span></p>
      <h1>Contributions</h1>
      <p className="lead">
        Chaque contribution arrive avec son diff, sa raison et les résultats de tous les scénarios de test.
        Le propriétaire de l'automatisation décide.
      </p>

      {toReview.length > 0 && (
        <p className="notice wait" style={{ marginBottom: 20 }}>
          {toReview.length} contribution{toReview.length > 1 ? "s" : ""} attend{toReview.length > 1 ? "ent" : ""} votre décision.
        </p>
      )}

      {contributions.length === 0 ? (
        <p className="empty">Aucune contribution pour l'instant.</p>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Automatisation</th><th>Auteur</th><th>Raison</th><th>Statut</th><th>Date</th><th className="r"> </th></tr>
            </thead>
            <tbody>
              {contributions.map((c) => {
                const passed = c.results?.filter((r) => r.copy.passed).length ?? 0;
                return (
                  <tr key={c.id}>
                    <td className="mono">#{c.id}</td>
                    <td>{c.title}<div className="tiny muted">depuis la v{c.base_number}</div></td>
                    <td>{userName(c.author)}</td>
                    <td>{c.reason}<div className="tiny muted">tests : {passed} / {c.results?.length ?? 0}</div></td>
                    <td>
                      <span className={`tag ${STATUS[c.status].cls}`}>
                        {STATUS[c.status].label}{c.status === "approved" && c.published_version ? ` · v${c.published_version}` : ""}
                      </span>
                    </td>
                    <td className="tiny muted nowrap">{frDateTime(c.proposed_at ?? c.created_at)}</td>
                    <td className="r"><Link className="small" href={`/c/${c.id}`}>ouvrir →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
