import pg from 'pg';
import type { QueryEngine, QueryResult } from './engine';

const { Pool } = pg;

/**
 * Production PostgreSQL adapter (cloud / docker / managed).
 * Activated automatically when DATABASE_URL is set.
 */
export class PgPoolEngine implements QueryEngine {
  readonly kind = 'postgres' as const;
  private pool: pg.Pool;

  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async query(text: string, params: unknown[] = []): Promise<QueryResult> {
    const res = await this.pool.query(text, params as any[]);
    return {
      fields: res.fields,
      rows: res.rows as Record<string, unknown>[],
      rowCount: res.rowCount ?? res.rows.length,
    };
  }

  async exec(text: string): Promise<void> {
    await this.pool.query(text);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}