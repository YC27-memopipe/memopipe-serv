// Explicitly simulated provider output for tests only. Never imported by production code.
export const TEST_DSL = `SET p = ticket.requester
IF p.contract == "prestataire"
  DO iam.grant user=p.email system="github" level="read" expires=ticket.requester.end_date
  DO iam.grant user=p.email system="vpn-prod" level="none"
  DO iam.grant user=p.email system="slack" level="guest" expires=ticket.requester.end_date
ELSE
  DO iam.grant user=p.email system="github" level="write"
  DO iam.grant user=p.email system="vpn-prod" level="access"
  DO iam.grant user=p.email system="slack" level="member"
END
DO tickets.comment id=ticket.id text="Accès attribués."
DO tickets.close id=ticket.id`;

export const TEST_RESPONSE = {
  schema_version: "memopipe-diagnosis-output/v1",
  summary: "Réponse simulée : le profil standard ne respecte pas le cas prestataire.",
  causes: [{ kind: "hypothesis", explanation: "Le contrat peut expliquer les permissions différentes ; confirmer la règle métier.", source_lines: [1], evidence_ids: [] }],
  open_questions: ["Cette règle doit-elle s’appliquer à tous les prestataires ?"],
  proposed_dsl: TEST_DSL,
  change_explanation: "Réponse simulée : proposer une branche paramétrable par contrat et date de fin.",
};

export function simulatedProvider(value: unknown = TEST_RESPONSE): typeof fetch {
  return (async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] })) as typeof fetch;
}
