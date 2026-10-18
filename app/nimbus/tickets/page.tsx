import Link from "next/link";
import { listTickets } from "@/lib/data";
import { CONTRACTS, TICKET_STATUS } from "@/lib/labels";

export const metadata = { title: { absolute: "Tickets Nimbus" } };

export default async function TicketsPage() {
  const tickets = await listTickets();
  return (
    <>
      <h1>Tickets</h1>
      <p className="muted" style={{ marginTop: -6, marginBottom: 24 }}>Demandes d'accès des nouveaux arrivants.</p>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>Ticket</th><th>Demandeur</th><th>Contrat</th><th>Équipe</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/nimbus/tickets/${t.id}`}><b>{t.id}</b></Link></td>
                <td>{t.requester.name}<div className="tiny muted">{t.requester.email}</div></td>
                <td>{CONTRACTS[t.requester.contract] ?? t.requester.contract}</td>
                <td>{t.requester.team ?? "—"}</td>
                <td><span className={`tag ${t.status === "done" ? "ok" : t.status === "approved" ? "wait" : ""}`}>{TICKET_STATUS[t.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
