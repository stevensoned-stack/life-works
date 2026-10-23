// The server talks to Postgres through this one small interface, so the same
// SQL runs on a real Postgres 16 (pg) in production and on PGlite (Postgres
// compiled to WebAssembly) in tests, with nothing to install.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};

export async function connectPg(url: string): Promise<Sql> {
  const { Pool } = (await import('pg')).default;
  const pool = new Pool({ connectionString: url });
  return {
    query: async (text, params) => pool.query(text, params as unknown[]) as never,
    close: () => pool.end(),
  };
}

export async function connectMemory(): Promise<Sql> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  return {
    query: async (text, params) => db.query(text, params) as never,
    close: () => db.close(),
  };
}

// The schema is idempotent (create ... if not exists), so it runs on every start.
export async function migrate(sql: Sql) {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  // PGlite's query() takes one statement at a time; split on the marker line.
  for (const stmt of schema.split(/^-- ;$/m)) if (stmt.trim()) await sql.query(stmt);
}
