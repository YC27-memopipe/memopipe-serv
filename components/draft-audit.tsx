import { draftAudit } from "@/lib/audit";
import { userName } from "@/lib/data";
import { frDateTime } from "@/lib/labels";

export async function DraftAudit({ id }: { id: number }) {
  const events = await draftAudit(id);
  if (!events.length) return null;
  const labels: Record<string, string> = { "draft.saved": "Règles mises à jour", "draft.tested": "Vérifications effectuées", "ai.accepted": "Suggestion de l’assistant acceptée", "draft.proposed": "Modification soumise à validation", "draft.approved": "Modification approuvée et partagée", "draft.rejected": "Modification refusée" };
  return <details className="more"><summary>Historique des décisions</summary><ul>{events.map(e => <li key={e.id}>{frDateTime(e.created_at)} · {userName(e.actor)} · {labels[e.event] ?? "Mise à jour de la procédure"}</li>)}</ul></details>;
}
