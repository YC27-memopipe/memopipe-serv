// Accès à Postgres : n'importe quel Postgres si DATABASE_URL est défini (Prisma Postgres, Neon, Render…),
// sinon PGlite en local.
import { mkdirSync } from "node:fs";
import pg from "pg";
import { SCHEMA } from "./schema";

type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const store = globalThis as unknown as { __memopipeDb?: Promise<Query> };

async function connect(): Promise<Query> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // pg traite déjà « require » comme « verify-full » : on l'écrit explicitement pour éviter l'avertissement.
    const connectionString = url.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full");
    const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
    await pool.query(SCHEMA);
    return async (text, params = []) => (await pool.query(text, params)).rows;
  }

  if (process.env.RENDER || process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL manquant : en production, branchez une base Postgres (Prisma Postgres, Neon, Render…). " +
        "PGlite, le Postgres embarqué prévu pour le local, dépasse 512 Mo de mémoire au premier démarrage.",
    );
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  if (dir !== "memory://") mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.exec(SCHEMA);
  return async (text, params = []) => (await db.query<Record<string, unknown>>(text, params)).rows;
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
