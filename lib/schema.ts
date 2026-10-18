// Schéma Postgres, identique en production (Prisma Postgres ou tout autre Postgres) et sur PGlite (local).
export const DEMO_SESSION_SCHEMA = `create table if not exists demo_session (
  id integer primary key,
  started_at timestamptz not null
)`;

export const AI_SCHEMA = `
create table if not exists ai_analyses (
  id serial primary key,
  run_id integer not null references runs(id) on delete cascade,
  actor text not null,
  fingerprint text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  request jsonb not null,
  response jsonb,
  checks jsonb,
  status text not null default 'pending',
  error text,
  draft_id integer references drafts(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists audit_events (
  id serial primary key,
  actor text not null,
  event text not null,
  entity text not null,
  details jsonb not null,
  created_at timestamptz not null default now()
);
create unique index if not exists ai_one_pending on ai_analyses (run_id, actor) where status = 'pending';
`;

export const SCHEMA = `
create table if not exists automations (
  id serial primary key,
  slug text unique not null,
  title text not null,
  usage text not null default '',
  owner text not null,
  current_version integer,
  created_at timestamptz not null default now()
);
create table if not exists versions (
  id serial primary key,
  automation_id integer not null references automations(id) on delete cascade,
  number integer not null,
  dsl text not null,
  author text not null,
  note text not null default '',
  approved_by text,
  created_at timestamptz not null default now()
);
create table if not exists scenarios (
  id serial primary key,
  automation_id integer not null references automations(id) on delete cascade,
  title text not null,
  origin text not null,
  ticket jsonb not null,
  expected jsonb not null,
  evidence jsonb not null default '[]',
  added_by text not null,
  created_at timestamptz not null default now()
);
create table if not exists drafts (
  id serial primary key,
  automation_id integer not null references automations(id) on delete cascade,
  base_version integer not null references versions(id) on delete cascade,
  author text not null,
  dsl text not null,
  reason text not null default '',
  status text not null default 'draft',
  results jsonb,
  decided_by text,
  decided_at timestamptz,
  proposed_at timestamptz,
  published_version integer,
  created_at timestamptz not null default now()
);
create table if not exists comments (
  id serial primary key,
  draft_id integer not null references drafts(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists runs (
  id serial primary key,
  automation_id integer not null references automations(id) on delete cascade,
  scenario_id integer not null references scenarios(id) on delete cascade,
  source text not null,
  dsl text not null,
  test_ticket text not null default '',
  test_email text not null default '',
  state jsonb not null default '{}',
  status text not null default 'running',
  result jsonb,
  batch text,
  created_by text not null,
  created_at timestamptz not null default now()
);
create table if not exists tickets (
  id text primary key,
  type text not null,
  status text not null,
  requester jsonb not null,
  comments jsonb not null default '[]',
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists grants (
  email text not null,
  system text not null,
  level text not null,
  expires text,
  primary key (email, system)
);
create table if not exists console_saves (
  email text primary key,
  saved_at timestamptz not null
);
create table if not exists agent_jobs (
  id serial primary key,
  action text not null,
  args jsonb not null,
  status text not null default 'pending',
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  done_at timestamptz
);
create table if not exists agent_status (
  id integer primary key,
  label text not null,
  last_seen timestamptz not null
);
create table if not exists discoveries (
  id serial primary key,
  author text not null,
  start_time text not null,
  end_time text not null,
  status text not null default 'pending',
  job_id integer references agent_jobs(id) on delete set null,
  catalog jsonb not null,
  report jsonb,
  recommendations jsonb,
  error text,
  created_at timestamptz not null default now()
);
create table if not exists discovery_selections (
  discovery_id integer not null references discoveries(id) on delete cascade,
  automation_id integer not null references automations(id) on delete cascade,
  case_index integer not null,
  scenario_id integer references scenarios(id) on delete set null,
  run_id integer references runs(id) on delete set null,
  primary key (discovery_id, automation_id, case_index)
);
${DEMO_SESSION_SCHEMA};
${AI_SCHEMA}
`;

export const TABLES = [
  "demo_session", "ai_analyses", "audit_events",
  "discovery_selections", "discoveries",
  "comments", "runs", "drafts", "scenarios", "versions", "automations", "grants", "console_saves", "tickets", "agent_jobs", "agent_status",
];
