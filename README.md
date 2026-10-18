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

## Déployer sur Render

1. Créer un service web à partir du dépôt (runtime Node). Build Command : `bun install && bun run build`. Start Command : `bun run start`. Render fournit `PORT` tout seul.
2. Dans l'onglet Environment, définir `DATABASE_URL` avec la chaîne de connexion d'une base Postgres (Prisma Postgres, Neon ou Render). Les tables et les données de démo sont créées au premier appel. Sans cette variable, le hub refuse de démarrer : PGlite, le Postgres embarqué prévu pour le local, dépasse les 512 Mo de mémoire de l'offre gratuite.
3. Optionnel : définir `MEMOPIPE_TEAM_TOKEN`. Le script `canary:analyze` devra alors l'envoyer dans `Authorization: Bearer <jeton>`.

## Gmail réel : l'agent local

Les actions `iam.*` et `tickets.*` agissent sur l'app de démo. Les actions `gmail.*` sont réelles et passent par Screenpipe :

| Action | Ce qu'elle fait | Par où |
|---|---|---|
| `DO gmail.search query="…" limit="5" -> mails` | Cherche dans la boîte de réception ; `mails.count`, `mails.first.subject`, `mails.first.from`, `mails.first.snippet` | Connexion IMAP de Screenpipe |
| `DO gmail.send to=… subject="…" body="…"` | Envoie un email depuis Gmail | Navigateur piloté par Screenpipe (rédaction préremplie, clic sur « Envoyer ») |

Le hub (Render) ne peut pas joindre Screenpipe, qui tourne sur `localhost`. Il met donc ces actions en file d'attente (table `agent_jobs`). L'agent local du dépôt **memopipe-local**, lancé sur le PC qui a Screenpipe, vient les chercher, les exécute et renvoie le résultat. La page de test pas à pas l'affiche comme les autres étapes.

Côté hub, deux routes, protégées par `MEMOPIPE_TEAM_TOKEN` :
- `GET /api/agent/next` : l'agent signale sa présence et prend la plus ancienne action en attente (`{ job: { id, action, args } | null }`).
- `POST /api/agent/jobs/<id>` : l'agent renvoie `{ ok: true, result }` ou `{ ok: false, error }`.

Si aucun agent ne répond en 60 s, l'étape échoue avec un message qui dit de lancer l'agent. La barre du haut affiche « Gmail · agent en ligne » ou « hors ligne ».

Pour lancer l'agent, voir le README de memopipe-local (`bun run canary:agent`). Il exige un jeton : définir `MEMOPIPE_TEAM_TOKEN` sur Render et la même valeur dans `CANARY_TEAM_TOKEN` côté local.

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
