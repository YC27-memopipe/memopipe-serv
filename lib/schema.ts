// Schéma Postgres, identique en production (Prisma Postgres ou tout autre Postgres) et sur PGlite (local).
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
)
`;

export const TABLES = ["comments", "runs", "drafts", "scenarios", "versions", "automations", "grants", "console_saves", "tickets"];
