import Link from "next/link";
import { PublishForm } from "@/components/forms";
import { userName } from "@/lib/data";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Publier une automatisation" };

const TEMPLATE = `SET p = ticket.requester
DO iam.grant user=p.email system="github" level="write"
DO iam.grant user=p.email system="vpn-prod" level="access"
DO iam.grant user=p.email system="slack" level="member"
DO tickets.comment id=ticket.id text="Accès standards attribués."
DO tickets.close id=ticket.id
`;

export default async function NewAutomationPage() {
  const user = await currentUser();
  return (
    <>
      <Link className="back" href="/">← Automatisations</Link>
      <div className="head">
        <h1>Nouvelle automatisation</h1>
        <p className="meta">Visible par toute l'équipe. {userName(user)} en reste propriétaire et approuve les contributions.</p>
      </div>
      <PublishForm template={TEMPLATE} />
    </>
  );
}
