// Données de départ de la démo (toutes fictives).
import type { Expected, Ticket } from "./types";

export const DEMO_TICKETS: Ticket[] = [
  {
    id: "T-1175",
    type: "access_request",
    status: "open",
    requester: { name: "Hugo Petit", email: "hugo.petit@nimbus.example", contract: "cdi", team: "support" },
    comments: [{ author: "Julie Moreau", text: "Arrivée lundi au support. Profil standard.", at: "2026-10-16T08:10:00Z" }],
  },
  {
    id: "T-1182",
    type: "access_request",
    status: "open",
    requester: { name: "Inès Fabre", email: "ines.fabre@presta.example", contract: "prestataire", team: "data", end_date: "2027-01-15" },
    comments: [
      {
        author: "Karim Haddad",
        text: "Mission de 3 mois en prestation : GitHub en lecture seule, pas de VPN prod, accès jusqu'au 15/01.",
        at: "2026-10-16T09:02:00Z",
      },
    ],
  },
  {
    id: "T-1201",
    type: "access_request",
    status: "open",
    requester: { name: "Nora Diallo", email: "nora.diallo@presta.example", contract: "prestataire", team: "design", end_date: "2027-03-31" },
    comments: [{ author: "Léa Garnier", text: "Prestation design jusqu'à fin mars.", at: "2026-10-17T14:30:00Z" }],
  },
];

export const ALICE_AUTOMATION = {
  slug: "attribuer-acces",
  title: "Attribuer les accès d'un nouvel arrivant",
  usage: "Demandes d'accès approuvées. Attribue le profil standard.",
  owner: "alice",
  dsl: `AUTOMATION "Attribuer les accès d'un nouvel arrivant"
USAGE "Demandes d'accès approuvées. Attribue le profil standard."

SET p = ticket.requester
DO iam.grant user=p.email system="github" level="write"
DO iam.grant user=p.email system="vpn-prod" level="access"
DO iam.grant user=p.email system="slack" level="member"
DO tickets.comment id=ticket.id text="Accès standards attribués."
DO tickets.close id=ticket.id
`,
};

export const ALICE_SCENARIO = {
  title: "CDI développement",
  origin: "Manuel · Alice",
  ticket: {
    id: "T-1171",
    type: "access_request",
    requester: { name: "Lucas Martin", email: "lucas.martin@nimbus.example", contract: "cdi", team: "dev" },
  },
  expected: { github: "write", "vpn-prod": "access", slack: "member", ticket_status: "done" } satisfies Expected,
  evidence: [],
};

/** Exemple proposé dans le formulaire « Ajouter un scénario ». */
export const SCENARIO_EXAMPLE = {
  title: "Prestataire externe, mission de 3 mois",
  origin: "Manuel",
  ticket: {
    id: "T-1182",
    type: "access_request",
    requester: { name: "Inès Fabre", email: "ines.fabre@presta.example", contract: "prestataire", team: "data", end_date: "2027-01-15" },
  },
  expected: { github: "read", "vpn-prod": "none", slack: "guest", expires_before: "2027-01-15", ticket_status: "done" },
  evidence: [],
};
