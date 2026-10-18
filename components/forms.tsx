"use client";

import { useActionState } from "react";
import { addScenarioAction, publishAction, type FormState } from "@/app/(hub)/actions";

export function PublishForm({ template }: { template: string }) {
  const [state, action, pending] = useActionState(publishAction, {} as FormState);
  return (
    <form action={action}>
      {state.error && <p className="notice ko" role="alert">{state.error}</p>}
      <div className="split even" style={{ marginTop: 16 }}>
        <div>
          <label className="field">
            <span>Titre</span>
            <input type="text" name="title" defaultValue={state.values?.title ?? ""} placeholder="Attribuer les accès d'un nouvel arrivant" />
          </label>
          <label className="field">
            <span>Conditions d'utilisation</span>
            <textarea name="usage" defaultValue={state.values?.usage ?? ""} placeholder="Dans quels cas l'utiliser, ce qu'elle fait, ses limites connues." />
          </label>
          <div className="notice small">
            <b>Instructions :</b> <span className="mono">SET</span>, <span className="mono">DO</span>, <span className="mono">IF … ELSE … END</span>.
            <br />
            <b>Actions :</b> <span className="mono">iam.grant</span> (user, system, level, expires), <span className="mono">tickets.comment</span> (id, text),{" "}
            <span className="mono">tickets.close</span> (id).
            <br />
            <b>Gmail réel, via Screenpipe :</b> <span className="mono">gmail.search</span> (query, limit) <span className="mono">-&gt; mails</span>,{" "}
            <span className="mono">gmail.send</span> (to, subject, body).
            <br />
            <b>Systèmes :</b> github (none, read, write), vpn-prod (none, access), slack (none, guest, member).
            <br />
            <span className="mono">ticket</span> désigne le ticket traité. Conditions : <span className="mono">==</span>, <span className="mono">!=</span>,{" "}
            <span className="mono">contains</span>, <span className="mono">not</span>, <span className="mono">and</span>, <span className="mono">or</span>.
          </div>
        </div>
        <label className="field">
          <span>Automatisation</span>
          <textarea className="dsl" name="dsl" defaultValue={state.values?.dsl ?? template} spellCheck={false} />
        </label>
      </div>
      <div className="row end">
        <button className="btn" type="submit" disabled={pending}>{pending ? "Publication…" : "Publier la v1"}</button>
      </div>
    </form>
  );
}

export function ScenarioForm({ slug, example }: { slug: string; example: string }) {
  const [state, action, pending] = useActionState(addScenarioAction.bind(null, slug), {} as FormState);
  return (
    <form action={action}>
      {state.error && <p className="notice ko" role="alert">{state.error}</p>}
      <label className="field">
        <span>Scénario (JSON)</span>
        <textarea className="json" name="json" defaultValue={state.values?.json ?? example} spellCheck={false} />
      </label>
      <div className="row between">
        <span className="tiny muted">Les scénarios issus de Screenpipe arrivent tout seuls, envoyés par le script canary:analyze.</span>
        <button className="btn sm" type="submit" disabled={pending}>{pending ? "Ajout…" : "Ajouter le scénario"}</button>
      </div>
    </form>
  );
}
