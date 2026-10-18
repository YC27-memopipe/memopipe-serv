import Link from "next/link";
import { PublishForm } from "@/components/forms";
import { userName } from "@/lib/data";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Partager une procédure" };

export default async function NewAutomationPage() {
  const user = await currentUser();
  return (
    <>
      <Link className="back" href="/">← Catalogue</Link>
      <div className="head">
        <h1>Partager une procédure</h1>
        <p className="meta">Visible par toute l'équipe. {userName(user)} en reste propriétaire et approuve les contributions.</p>
      </div>
      <PublishForm />
    </>
  );
}
