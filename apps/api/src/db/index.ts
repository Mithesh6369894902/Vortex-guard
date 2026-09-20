import type { QueryEngine } from './engine';
import { PgPoolEngine } from './pgpool';
import { PGliteEngine } from './pglite';

let _engine: QueryEngine | null = null;

/** Singleton engine. Uses DATABASE_URL when present, else embedded PostgreSQL. */
export async function getEngine(): Promise<QueryEngine> {
  if (_engine) return _engine;
  const url = process.env.DATABASE_URL;
  _engine = url ? new PgPoolEngine(url) : await PGliteEngine.connect();
  return _engine;
}

export function engineKind(): 'pglite' | 'postgres' {
  return process.env.DATABASE_URL ? 'postgres' : 'pglite';
}

export async function disposeEngine(): Promise<void> {
  await _engine?.close();
  _engine = null;
}