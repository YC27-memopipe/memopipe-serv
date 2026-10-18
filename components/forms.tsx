"use client";
import { useActionState } from "react";
import { addScenarioAction, publishAction, type FormState } from "@/app/(hub)/actions";
import { CONTRACTS, SYSTEM_IDS, SYSTEMS } from "@/lib/labels";

function PermissionFields({ values }: { values?: Record<string, string> }) {
  return <div className="perm">{SYSTEM_IDS.map(system => <label className="field" key={system}><span>{SYSTEMS[system].label}</span><select name={system} defaultValue={values?.[system] ?? "none"}>{Object.entries(SYSTEMS[system].levels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>)}</div>;
}

export function PublishForm() {
  const [state, action, pending] = useActionState(publishAction, {} as FormState);
  return <form action={action}>
    {state.error && <p className="notice ko" role="alert">{state.error}</p>}
    <label className="field"><span>Nom de la procédure</span><input name="title" required maxLength={160} defaultValue={state.values?.title ?? ""} placeholder="Attribuer les accès d’un nouvel arrivant" /></label>
    <label className="field"><span>Quand faut-il l’utiliser ?</span><textarea name="usage" required defaultValue={state.values?.usage ?? ""} placeholder="Pour les demandes approuvées des nouveaux arrivants de l’équipe…" /></label>
    <section className="block"><h2>Les droits à attribuer</h2><p className="plain">Cette procédure gère les accès d’une personne à partir de sa demande. Choisissez les droits à lui accorder.</p><PermissionFields values={state.values} />
    <label className="consent"><input type="checkbox" name="temporary" value="yes" defaultChecked={state.values?.temporary === "yes"} /> Limiter ces droits à la fin de mission renseignée dans la demande.</label>
    <p className="plain">Une note sera ajoutée et la demande sera marquée comme terminée après l’attribution des droits.</p></section>
    <div className="row end"><button className="btn" type="submit" disabled={pending}>{pending ? "Publication…" : "Partager la procédure"}</button></div>
  </form>;
}

export function ScenarioForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(addScenarioAction.bind(null, slug), {} as FormState);
  const value = (name: string) => state.values?.[name] ?? "";
  return <form action={action}>
    {state.error && <p className="notice ko" role="alert">{state.error}</p>}
    <label className="field"><span>Nom de la situation</span><input name="title" required defaultValue={value("title")} placeholder="Prestataire avec une mission de trois mois" /></label>
    <div className="split even"><label className="field"><span>Nom du demandeur</span><input name="name" required defaultValue={value("name")} /></label><label className="field"><span>Adresse professionnelle</span><input name="email" type="email" required defaultValue={value("email")} /></label></div>
    <div className="split even"><label className="field"><span>Type de contrat</span><select name="contract" defaultValue={value("contract") || "cdi"}>{Object.entries(CONTRACTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="field"><span>Équipe</span><input name="team" defaultValue={value("team")} /></label></div>
    <label className="field"><span>Fin de mission, si applicable</span><input type="date" name="end_date" defaultValue={value("end_date")} /></label>
    <h3>Résultat attendu</h3><PermissionFields values={state.values} />
    <label className="field"><span>Date limite des accès, si nécessaire</span><input type="date" name="expires" defaultValue={value("expires")} /></label>
    <p className="tiny muted">Cette situation sera ajoutée aux vérifications de la procédure. La demande devra être terminée après son exécution.</p>
    <button className="btn" type="submit" disabled={pending}>{pending ? "Ajout…" : "Ajouter cette situation"}</button>
  </form>;
}
