# memopipe — hub d'équipe

Une équipe partage ses automatisations. Avant d'en réutiliser une, chacun la teste sur les cas réels de son historique Screenpipe, voit le résultat de chaque étape, la corrige et propose sa correction. Le propriétaire approuve, et la nouvelle version profite à tout le monde.

## Découverte à partir de Screenpipe

L’interface est conçue pour des utilisateurs métier : **Catalogue → Mes recommandations → Essayer une situation → Adapter les règles → Faire valider**. Les procédures, cas de référence et modifications se renseignent avec des formulaires. Le code, les commandes et les réglages d’intégration restent dans la documentation technique. Les réinitialisations et le guidage de démonstration ne sont plus exposés dans l’application.

Nimbus est accessible sous `/nimbus/tickets`. Les anciennes adresses `/demo/*` redirigent vers `/nimbus/*`. Les imports synthétiques restent signalés comme **Données d’exemple** ; leurs citations ne sont pas présentées comme des captures réelles. Les droits de validation et les consentements sont conservés.

Le catalogue propose **« Trouver une procédure pour moi »** (`/decouvrir`). Bob autorise une lecture bornée de son historique local, puis le hub rapproche les cas Nimbus retrouvés du code des procédures publiées, sans choisir d’automatisation au départ et sans utiliser l’historique d’Alice.

1. Définir `MEMOPIPE_TEAM_TOKEN` dans le hub.
2. Dans `memopipe-local/.env`, définir `SCREENPIPE_LOCAL_API_KEY`, `CANARY_HUB_URL`, `CANARY_TEAM_TOKEN` (même secret) et `CANARY_AUTHOR=Bob`.
3. Lancer `bun run canary:agent` sur le PC de Bob. Gmail n’est pas requis.
4. Traiter des tickets dans `/nimbus/tickets` avec Screenpipe actif, enregistrer leurs permissions, puis ouvrir `/decouvrir` dans le hub en tant que Bob.
5. Autoriser l’analyse Screenpipe, examiner les recommandations et confirmer les références à tester. Après un échec, examiner le contexte minimisé et consentir séparément à son envoi à OpenAI. Le modèle explique les différences et peut proposer du DSL ; le serveur valide et teste cette proposition.
6. La copie est testée sur tous les cas validés, puis proposée à Alice. L’approbation publie une version commune de la même procédure.

Alternative terminal : `bun run canary:discover --since 24h` dans le dépôt local. `--fixtures fixtures/bob.json` rejoue une **démo fictive**, annoncée comme telle.

Le rapprochement est spécialisé Nimbus. Le diagnostic et la correction passent par une vraie API IA ; aucune explication par règles ne la remplace. Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour les contrats, limites et commandes complètes.

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
bun run check:workflow  # après build : vrai CLI + serveur HTTP + formulaires, fixtures et base en mémoire
```

## Déployer sur Render

1. Créer un service web à partir du dépôt (runtime Node). Build Command : `bun install && bun run build`. Start Command : `bun run start`. Render fournit `PORT` tout seul.
2. Dans l'onglet Environment, définir `DATABASE_URL` avec la chaîne de connexion d'une base Postgres (Prisma Postgres, Neon ou Render). Les tables et les données de démo sont créées au premier appel. Sans cette variable, le hub refuse de démarrer : PGlite, le Postgres embarqué prévu pour le local, dépasse les 512 Mo de mémoire de l'offre gratuite.
3. Optionnel : définir `MEMOPIPE_TEAM_TOKEN`. Le script `canary:analyze` devra alors l'envoyer dans `Authorization: Bearer <jeton>`.

## Brancher le diagnostic OpenAI

Ajouter dans `memopipe-serv/.env` puis redémarrer le hub :

```dotenv
OPENAI_API_KEY=
AI_MODEL=
AI_BASE_URL=https://api.openai.com/v1
```

La clé reste sur le serveur. `AI_MODEL` doit être un modèle de votre compte supportant Chat Completions et JSON Schema strict. Sans clé/modèle, l’écran explique que l’IA n’est pas configurée. La découverte Screenpipe, les tests et la modification manuelle fonctionnent.

Sur un run en échec : **Examiner le contexte envoyé à l’IA** → cocher l’autorisation → **Demander le diagnostic IA** → examiner explication, hypothèses et diff → confirmer la revue → **Accepter dans une copie et tester tous les cas**. La copie reste éditable avant proposition à Alice.

Les entrées/sorties sont versionnées. Les références inventées et actions non autorisées sont refusées. Les tests n’autorisent que les actions Nimbus sur le ticket et le demandeur dédiés au run ; Gmail est bloqué, même dans une branche inactive. Les anciens connecteurs Gmail restent présents dans l’agent local, hors de ce parcours.

Le consentement, le fournisseur/modèle, les propositions acceptées, les sauvegardes, tests et décisions sont tracés. L’interface de revue affiche ce journal. Les identités par cookie restent celles d’une démonstration ; l’authentification de production et la politique de rétention restent à prévoir. Le masquage réduit les identifiants connus sans garantir l’anonymisation du texte libre.

Le test `bun run check:workflow` utilise un **fournisseur IA simulé** via HTTP et une base mémoire. Il vérifie le parcours sans appeler OpenAI ni lire vos captures.

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
