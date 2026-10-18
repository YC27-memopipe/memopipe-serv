# MemoPipe

MemoPipe helps IT operations and support teams turn a teammate's procedure into a tested, reviewed procedure the team can reuse. It uses permissioned Screenpipe observations to build reference cases, measures where a shared procedure fails, and supports a human-reviewed correction before publishing a new version.

This repository contains the web hub, the fictional Nimbus IT demo application, and the hub's independent automation runner. The companion local Screenpipe agent and TypeScript engine live in [memopipe-local](https://github.com/YC27-memopipe/memopipe-local). The user interface is currently in French.

## Example

Alice's new-hire procedure passes her permanent-employee case. Bob's contractor case needs GitHub read access, no production VPN, Slack guest access, and an expiry date. The original procedure produces **four differences** on that case. Bob can review the observations, test a proposed correction against the accepted cases, and send it to Alice for approval. A passing regression set is evidence about those cases, not proof of a universal access policy.

**Nimbus IT is fictional.** Permission changes are real database writes in this demonstration app; they do not grant actual GitHub, VPN, or Slack access. Screenpipe can record a user's interaction with the app. Replayed fixtures are labeled as sample data.

## What works

- A versioned procedure catalogue, reference cases, comments, editable copies, and owner review.
- Consent-scoped, time-bounded Screenpipe searches, accessibility normalization, OCR fallback, pagination, and evidence excerpts.
- Discovery of Nimbus cases and deterministic matching against published procedure code.
- Human acceptance of reference cases, isolated test tickets, and expected-versus-observed comparisons.
- A configurable AI HTTP client for diagnosis and DSL proposals, with a separate context preview and consent.
- Schema validation, sandboxed rehearsal, regression checks, and publication by a different owner.

The hub has its **own** DSL runner and does not currently import `@canary/local`. The repositories connect through HTTP scenario and report contracts. They are separate implementations.

## Run locally

Requirements: Bun 1.3 or newer and Node.js 20.9 or newer. Verified on macOS Apple Silicon with Bun 1.4.3 and Node.js 22.13.1.

```sh
git clone https://github.com/YC27-memopipe/memopipe-serv.git
cd memopipe-serv
bun install --frozen-lockfile
cp -n .env.example .env.local
```

Set a private, nonempty `MEMOPIPE_TEAM_TOKEN` in `.env.local` before connecting the local agent; use the same value for `CANARY_TEAM_TOKEN`. Keep secrets out of Git, chat, screenshots, and recordings.

```sh
bun run dev --hostname 127.0.0.1 --port 3000
```

Open <http://127.0.0.1:3000>. With `DATABASE_URL` empty, PGlite stores data under `.data/pglite`. The schema and fictional seed are initialized on first access; startup does not reset existing data. Use a separate fresh store for a demo instead of deleting or resetting an existing database.

The local agent runs from the sibling repository on the computer with Screenpipe:

```sh
cd ../memopipe-local
bun install --frozen-lockfile
cp -n .env.example .env
# Privately configure SCREENPIPE_LOCAL_API_KEY, CANARY_HUB_URL,
# CANARY_TEAM_TOKEN and CANARY_AUTHOR=Bob in .env.
bun run canary:agent
```

Screenpipe must be running locally. The agent does not retrieve a missing API key. Gmail is not needed for the Screenpipe discovery flow.

## Configuration

See [.env.example](.env.example). Keep private values server-side; never put them in `NEXT_PUBLIC_*` variables.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Optional locally; PostgreSQL connection string for a hosted hub. |
| `PGLITE_DIR` | Local store directory, default `.data/pglite`; tests use `memory://`. |
| `MEMOPIPE_TEAM_TOKEN` | Shared API token for the connected agent. Configure it even though not every hub route enforces it. |
| `OPENAI_API_KEY` | Server-only provider key for live AI diagnosis. `AI_API_KEY` is a fallback. |
| `AI_MODEL` | Required actual provider model identifier; there is no hard-coded model default. |
| `AI_BASE_URL` | Defaults to `https://api.openai.com/v1`; provider must support Chat Completions and strict JSON Schema. |
| `MEMOPIPE_AGENT_TIMEOUT_MS` | Queued action wait limit, default `60000`. |
| `MEMOPIPE_DIST_DIR` | Next.js output directory, default `.next`. |

The team's supplied model label is **GPT Luna**. This is a presentation label, not a verified API model identifier. This validation pass had no live provider key/model configured and made no paid AI calls. Set `AI_MODEL` to a real model available to your provider/account. Without AI configuration, the assistant is unavailable; deterministic tests, discovery, and manual editing remain available. AI and hosting providers may charge fees; cost depends on the chosen model and usage.

## Pages

| Route | Purpose |
| --- | --- |
| `/` and `/a/attribuer-acces` | Procedure catalogue and seeded example |
| `/decouvrir` and `/decouvrir/<id>` | Consent, recommendations, evidence, and case acceptance |
| `/runs/<id>` | Run results and AI diagnosis |
| `/d/<id>` and `/c/<id>` | Editable copy and owner review |
| `/a/new`, `/contributions`, `/equipe` | Procedure creation, contributions, and team status |
| `/nimbus/tickets/T-1175`, `/nimbus/tickets/T-1182` | Fictional tickets to observe |
| `/nimbus/console/<email>` | Fictional permission console |

The names Alice, Bob, and Chloé are demo identities selected in a cookie, not production authentication. Nimbus permissions are simulated. Legacy Gmail handlers exist in the local agent, but the hub's test policy rejects Gmail actions; this project does not claim a validated Gmail integration.

## Checks

```sh
bun test
bun x tsc --noEmit
MEMOPIPE_DIST_DIR=.next-check bun run build
MEMOPIPE_DIST_DIR=.next-check bun run check:workflow
```

The workflow check runs the Next.js server, local CLI, in-memory database, and a **simulated HTTP AI provider**. It does not read Screenpipe history or call Gmail/OpenAI. On 18 October 2026, 35 hub tests and 107 local tests passed; type checks, production build, workflow check, and independent TypeScript package installation passed.

## Prototype limits

- Nimbus is a fictional app, not a connection to real access-management systems.
- The observer recognizes Nimbus labels and screens; it is not a general-purpose workflow miner.
- Matching measures structural overlap, not probability of success. AI diagnosis is separate from matching.
- Demo identities are not organization accounts. The team token does not protect every web page.
- Selected excerpts and saved contexts may contain private text. Minimization does not guarantee anonymization; retention, stronger access control, and per-agent identity need production work.
- Concurrency and durable exactly-once mutation receipts are not production guarantees. The hub and local engine are separate implementations.
- No external-person reproduction, live AI quality run, or fresh live Screenpipe-to-published-version run was established in this validation pass.
- A destructive reset API exists for disposable demos. Do not use it against an existing or shared database.

## Team

SOK Vibol Arnaud · KARMENOVA Amina · SAIDI Lena · YEKENE Sofiane.

The team delivery covers the hub/interface, local observation and runner, reviewed AI flow, and integration/demo validation. Individual task attribution was not independently established. The demo video is supplied separately by the team.
