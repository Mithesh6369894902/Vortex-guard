/**
 * Database engine abstraction.
 * The application runs against real PostgreSQL semantics in every mode:
 *  - embedded (PGlite - zero-install, offline)
 *  - a real PostgreSQL via DATABASE_URL (cloud / docker / managed)
 */
export interface QueryResult {
  fields: { name: string; dataTypeID?: number }[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface QueryEngine {
  /** Run a read-only query with parameters. */
  query(text: string, params?: unknown[]): Promise<QueryResult>;
  /** Run one or more statements (DDL / seeding). */
  exec(text: string): Promise<void>;
  close(): Promise<void>;
  kind: 'pglite' | 'postgres';
}