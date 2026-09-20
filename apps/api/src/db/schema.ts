/**
 * VertexGuard demo warehouse schema (real PostgreSQL dialect).
 * Runs identically in embedded PGlite and production Postgres.
 */

export const SCHEMA_SQL = `
DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS audit_runs;

CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  brand       TEXT,
  unit_price  NUMERIC(12,2) NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0,
  created_at  DATE NOT NULL
);

CREATE TABLE customers (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  city           TEXT NOT NULL,
  state          TEXT NOT NULL,
  pincode        TEXT,
  aadhaar        TEXT,
  monthly_income NUMERIC(12,2),
  loyalty_tier   TEXT NOT NULL DEFAULT 'standard',
  is_vip         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     DATE NOT NULL
);

CREATE TABLE orders (
  id             INTEGER PRIMARY KEY,
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  created_at     TIMESTAMP NOT NULL,
  status         TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  discount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(12,2) NOT NULL
);

CREATE TABLE order_items (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL
);

CREATE TABLE refunds (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  amount     NUMERIC(12,2) NOT NULL,
  reason     TEXT,
  created_at DATE NOT NULL
);

CREATE TABLE audit_runs (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL,
  question      TEXT NOT NULL,
  role          TEXT NOT NULL,
  engine        TEXT NOT NULL,
  verdict       TEXT NOT NULL,
  trust_score   NUMERIC(6,2) NOT NULL,
  sql_text      TEXT NOT NULL,
  fingerprint   TEXT NOT NULL,
  check_count   INTEGER NOT NULL,
  failed_checks INTEGER NOT NULL,
  verified_claims INTEGER NOT NULL,
  mismatched_claims INTEGER NOT NULL,
  answer_kind   TEXT NOT NULL,
  executed_at   TIMESTAMPTZ NOT NULL,
  duration_ms   INTEGER NOT NULL,
  detail        JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_items_product ON order_items(product_id);
`;