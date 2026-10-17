# memopipe — hub d'équipe

Une équipe partage ses automatisations. Avant d'en réutiliser une, chacun la teste sur les cas réels de son historique Screenpipe, voit le résultat de chaque étape, la corrige et propose sa correction. Le propriétaire approuve, et la nouvelle version profite à tout le monde.

Ce dépôt contient le hub (catalogue, tests pas à pas, copies de travail, contributions, versions), l'app de démo fictive « Nimbus IT » (tickets et console des permissions) et le moteur des automatisations. Le détail est dans [ARCHITECTURE.md](ARCHITECTURE.md).

## Lancer en local

Prérequis : [Bun](https://bun.sh) 1.2 ou plus, Node.js 20.9 ou plus.

```sh
bun install
bun run dev        # http://localhost:3000
```

Sans `DATABASE_URL`, le hub utilise PGlite, un vrai Postgres embarqué stocké dans `.data/pglite`. Au premier lancement, il crée la v1 d'Alice, son scénario CDI et les tickets de démo.

```sh
bun run test       # moteur + parcours complet sur un Postgres en mémoire
bun run build      # compilation de production (vérifie aussi les types)
```

## Déployer sur Vercel

1. Importer le dépôt dans Vercel (framework : Next.js, racine du dépôt).
2. Ajouter Neon depuis l'onglet Storage (Marketplace) : `DATABASE_URL` est posé automatiquement. Les tables sont créées au premier appel.
3. Optionnel : définir `MEMOPIPE_TEAM_TOKEN`. Le script `memopipe:analyze` devra alors l'envoyer dans `Authorization: Bearer <jeton>`.

## Les écrans

| Adresse | Rôle |
|---|---|
| `/` | Catalogue de l'équipe |
| `/a/<slug>` | Fiche : version courante, scénarios de test, « Tout tester », contributions, historique |
| `/runs/<id>` | Test pas à pas : chaque clic exécute une ligne sur l'app de démo, puis compare attendu et obtenu |
| `/d/<id>` | Copie de travail : éditeur, « Tout tester » (version de base contre copie), diff, « Proposer » |
| `/c/<id>` | Contribution : raison, diff, résultats, discussion, décision du propriétaire |
| `/contributions`, `/equipe` | Toutes les contributions ; membres, branchement Screenpipe, réinitialisation de la démo |
| `/demo/tickets`, `/demo/console/<email>` | App de démo Nimbus IT, observée par Screenpipe |

En haut à droite, « Je suis Alice / Bob / Chloé » remplace l'authentification pour le prototype. Alice est propriétaire de l'automatisation de démo.

## API pour le script Screenpipe

```sh
# Automatisations disponibles
curl https://<hub>/api/scenarios

# Envoyer un scénario validé
curl -X POST https://<hub>/api/scenarios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MEMOPIPE_TEAM_TOKEN" \
  -d '{
    "automation": "attribuer-acces",
    "added_by": "bob",
    "title": "Prestataire externe, mission de 3 mois",
    "origin": "Screenpipe · Bob · T-1182",
    "ticket": { "id": "T-1182", "type": "access_request",
      "requester": { "name": "Inès Fabre", "email": "ines.fabre@presta.example",
                     "contract": "prestataire", "team": "data", "end_date": "2027-01-15" } },
    "expected": { "github": "read", "vpn-prod": "none", "slack": "guest",
                  "expires_before": "2027-01-15", "ticket_status": "done" },
    "evidence": [ { "frame_id": 51234, "quote": "GitHub : Lecture seule" } ]
  }'

# Remettre la démo à zéro ("demo" : tickets et accès ; "all" : tout, avec la v1 d'Alice)
curl -X POST https://<hub>/api/demo/reset -d '{"scope":"all"}'
```

Toutes les données sont fictives. Prototype réalisé pendant le hackathon Screenpipe (42 Paris, octobre 2026).
