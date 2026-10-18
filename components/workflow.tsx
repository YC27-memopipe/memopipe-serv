import { SYSTEMS } from "@/lib/labels";
import { workflowSteps } from "@/lib/business-workflow";

export function WorkflowView({ source }: { source: string }) {
  const steps = workflowSteps(source);
  return steps.length ? <ol className="workflow-steps">{steps.map(s => <li key={s.line}><span className="tiny muted">{s.condition}</span><div>{s.title}</div></li>)}</ol> : <p className="notice wait">Les étapes de cette procédure doivent être vérifiées par son responsable.</p>;
}

export function WorkflowChanges({ before, after }: { before: string; after: string }) {
  const previous = workflowSteps(before).map(s => `${s.condition} · ${s.title}`);
  const next = workflowSteps(after).map(s => `${s.condition} · ${s.title}`);
  const removed = previous.filter(s => !next.includes(s)), added = next.filter(s => !previous.includes(s));
  return added.length || removed.length ? <div className="business-changes">
    {removed.length > 0 && <div><h3>Règles remplacées</h3><ul>{removed.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
    {added.length > 0 && <div><h3>Nouvelles règles</h3><ul>{added.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
  </div> : <p>Les droits attribués restent identiques. Les autres changements figurent dans le déroulé de la procédure.</p>;
}

export function WorkflowFields({ source, readOnly = false }: { source: string; readOnly?: boolean }) {
  const steps = workflowSteps(source);
  return <div className="stack">{steps.map(s => s.editable && s.system && s.system in SYSTEMS ? <fieldset className="business-rule" key={s.line} disabled={readOnly}>
    <legend>{s.condition} · {SYSTEMS[s.system as keyof typeof SYSTEMS].label}</legend>
    <div className="split even"><label className="field"><span>Droits à attribuer</span><select name={`level_${s.line}`} defaultValue={s.level}>{Object.entries(SYSTEMS[s.system as keyof typeof SYSTEMS].levels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field"><span>Durée des droits</span><select name={`expiry_${s.line}`} defaultValue={s.expiry}><option value="none">Sans date limite</option><option value="mission">Jusqu’à la fin de mission</option>{s.expiry === "custom" && <option value="custom">Conserver la durée prévue</option>}</select></label></div>
  </fieldset> : <div className="item" key={s.line}><div><div className="s">{s.condition}</div><div>{s.title}</div></div></div>)}</div>;
}
