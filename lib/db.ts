// Accès à Postgres : Neon si DATABASE_URL est défini (Vercel), sinon PGlite en local.
import { mkdirSync } from "node:fs";
import { SCHEMA } from "./schema";

type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const store = globalThis as unknown as { __memopipeDb?: Promise<Query> };

const statements = () => SCHEMA.split(";").map((s) => s.trim()).filter(Boolean);

async function connect(): Promise<Query> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const [ready] = (await sql.query("select to_regclass('public.console_saves') as t")) as { t: string | null }[];
    if (!ready?.t) for (const stmt of statements()) await sql.query(stmt);
    return (text, params = []) => sql.query(text, params) as Promise<Record<string, unknown>[]>;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  if (dir !== "memory://") mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  await pg.exec(SCHEMA);
  return async (text, params = []) => (await pg.query<Record<string, unknown>>(text, params)).rows;
}

function connection(): Promise<Query> {
  store.__memopipeDb ??= connect().catch((e) => {
    store.__memopipeDb = undefined;
    throw e;
  });
  return store.__memopipeDb;
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await connection();
  return (await run(text, params)) as T[];
}

export async function q1<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}
