import { createHash } from "node:crypto";
import { q } from "./db";
import { AI_SCHEMA } from "./schema";

export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
let schemaReady: Promise<void> | undefined;
export async function ensureAiSchema() {
  schemaReady ??= (async () => {
    for (const statement of AI_SCHEMA.split(";").filter(s => s.trim())) await q(statement);
  })().catch(e => { schemaReady = undefined; throw e; });
  return schemaReady;
}

export async function audit(actor: string, event: string, entity: string, details: unknown) {
  await ensureAiSchema();
  await q("insert into audit_events (actor, event, entity, details) values ($1, $2, $3, $4::jsonb)", [actor, event, entity, JSON.stringify(details)]);
}

export async function draftAudit(id: number) {
  await ensureAiSchema();
  return q<{ id: number; actor: string; event: string; details: unknown; created_at: string }>("select * from audit_events where entity = $1 order by id", [`draft:${id}`]);
}
