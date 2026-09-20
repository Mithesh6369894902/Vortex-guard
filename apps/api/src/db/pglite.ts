import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import type { QueryEngine, QueryResult } from './engine';
import { dataDir } from '../paths';

/**
 * Embedded PostgreSQL (WASM). Zero-install, real Postgres dialect -
 * perfect for local/offline and CI. Data persists under <repo>/data/pglite.
 */
export class PGliteEngine implements QueryEngine {
  readonly kind = 'pglite' as const;
  private db: PGlite;

  private constructor(db: PGlite) {
    this.db = db;
  }

  static async connect(): Promise<PGliteEngine> {
    const env = process.env.PGLITE_DIR;
    const dir = env ? (path.isAbsolute(env) ? env : path.resolve(env)) : dataDir('pglite');
    fs.mkdirSync(dir, { recursive: true });

    // Clean stale lockfiles from previous interrupted runs
    try {
      const pidFile = path.join(dir, 'postmaster.pid');
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      const lockFiles = fs.readdirSync(dir).filter((f) => f.startsWith('.s.PGSQL'));
      for (const f of lockFiles) fs.unlinkSync(path.join(dir, f));
    } catch {
      /* ignore best-effort cleanup */
    }

    try {
      const db = new PGlite(dir);
      await db.waitReady;
      return new PGliteEngine(db);
    } catch (err) {
      console.warn('[pglite] recovery after lock conflict:', (err as Error).message);
      // Clean locks and retry
      try {
        const pidFile = path.join(dir, 'postmaster.pid');
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      } catch {}
      const db = new PGlite(dir);
      await db.waitReady;
      return new PGliteEngine(db);
    }
  }

  async query(text: string, params: unknown[] = []): Promise<QueryResult> {
    const res = await this.db.query(text, params as any);
    return {
      fields: (res.fields ?? []) as QueryResult['fields'],
      rows: (res.rows ?? []) as Record<string, unknown>[],
      rowCount: res.rows?.length ?? 0,
    };
  }

  async exec(text: string): Promise<void> {
    await this.db.exec(text);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}