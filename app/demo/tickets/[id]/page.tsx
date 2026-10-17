import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicket } from "@/lib/data";
import { CONTRACTS, frDate, frDateTime, TICKET_STATUS } from "@/lib/labels";
import { approveTicketAction, closeTicketAction, commentTicketAction } from "../../actions";

type Props = { params: Promise<{ id: string }> };

// Le titre « T-1182 · Tickets Nimbus » arrive dans le window_name de Screenpipe : il sert à découper l'historique par ticket.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  return { title: { absolute: `${id} · Tickets Nimbus` } };
}

export default async function TicketPage({ params }: Props) {
  const id = decodeURIComponent((await params).id);
  const t = await getTicket(id);
  if (!t) notFound();
  const r = t.requester;

  return (
    <>
      <Link className="back" href="/demo/tickets">← Tickets</Link>
      <h1>{t.id} · Demande d'accès</h1>
      {t.is_test && <p className="notice wait" style={{ marginBottom: 18 }}>Ticket de test créé par memopipe : copie fraîche d'un scénario.</p>}

      <div className="split">
        <section className="stack">
          {/* Une ligne = une seule chaîne de texte, pour que Screenpipe la capture d'un bloc. */}
          <div className="card facts">
            <p>{`Statut : ${TICKET_STATUS[t.status]}`}</p>
            <p>{`Demandeur : ${r.name}`}</p>
            <p>{`Email : ${r.email}`}</p>
            <p>{`Type de contrat : ${CONTRACTS[r.contract] ?? r.contract}`}</p>
            {r.team && <p>{`Équipe : ${r.team}`}</p>}
            {r.end_date && <p>{`Fin de mission : ${frDate(r.end_date)}`}</p>}
          </div>

          <div className="card" id="commentaires">
            <h2 style={{ marginBottom: 12 }}>Commentaires</h2>
            {t.comments.length === 0 && <p className="muted small">Aucun commentaire.</p>}
            <div className="stack">
              {t.comments.map((c, i) => (
                <div key={i}>
                  <p style={{ margin: 0 }}>{`${c.author} : ${c.text}`}</p>
                  <p className="tiny muted" style={{ margin: 0 }}>{frDateTime(c.at)}</p>
                </div>
              ))}
            </div>
            <form action={commentTicketAction} style={{ marginTop: 18 }}>
              <input type="hidden" name="id" value={t.id} />
              <div className="perm">
                <label className="field"><span>Auteur</span><input type="text" name="author" defaultValue="Équipe IT" /></label>
              </div>
              <label className="field"><span>Commentaire</span><textarea name="text" /></label>
              <div className="row end"><button className="btn ghost sm" type="submit">Commenter</button></div>
            </form>
          </div>
        </section>

        <section className="card stack">
          <h2>Actions</h2>
          <Link className="btn" href={`/demo/console/${encodeURIComponent(r.email)}`}>Ouvrir la console des permissions</Link>
          <div className="row">
            {t.status === "open" && (
              <form action={approveTicketAction}>
                <input type="hidden" name="id" value={t.id} />
                <button className="btn ghost" type="submit">Approuver</button>
              </form>
            )}
            {t.status !== "done" && (
              <form action={closeTicketAction}>
                <input type="hidden" name="id" value={t.id} />
                <button className="btn ghost" type="submit">Terminer</button>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
