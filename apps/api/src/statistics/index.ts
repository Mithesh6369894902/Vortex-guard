import type { Check, ExecutedResult } from '@vertexguard/shared';
import type { QueryEngine } from '../db/engine';

export interface StatsCheckOutcome {
  checks: Check[];
  metricsTotals: {
    grossValue: number | null;
    orders: number | null;
    customers: number | null;
    refunds: number | null;
  };
}

/**
 * Statistical Guard: probes the executed result (and warehouse baselines) for
 * the "plausible but absurd" signatures that fool human reviewers:
 *  - zero / huge row counts
 *  - null-heavy outputs
 *  - multiplication of billed quantities (double-counted line ids)
 *  - values that contradict known ranges (negative GMV, etc.)
 */
export async function runStatisticalGuard(db: QueryEngine, result: ExecutedResult | null, question: string): Promise<StatsCheckOutcome> {
  const checks: Check[] = [];
  const metricsTotals = {
    grossValue: null as number | null,
    orders: null as number | null,
    customers: null as number | null,
    refunds: null as number | null,
  };

  const pass = (title: string, detail: string) => checks.push({ id: `stt-${checks.length + 1}`, engine: 'statistics', severity: 'info', status: 'passed', title, detail });
  const warn = (title: string, detail: string) => checks.push({ id: `stt-${checks.length + 1}`, engine: 'statistics', severity: 'warning', status: 'warned', title, detail });
  const fail = (title: string, detail: string) => checks.push({ id: `stt-${checks.length + 1}`, engine: 'statistics', severity: 'critical', status: 'failed', title, detail });

  if (!result) {
    fail('Execution empty', 'No result set produced - nothing to statistically validate.');
    return { checks, metricsTotals };
  }

  if (result.rowCount === 0) {
    warn('Empty result set', 'The query returned zero rows. The answer may overstate coverage.');
  } else if (result.rowCount > 100000) {
    fail('Suspiciously large result set', `${result.rowCount.toLocaleString()} rows - near-certain double-counting or a missing join key.`);
  } else {
    pass('Row-count sanity', `${result.rowCount.toLocaleString()} rows returned in a natural range.`);
  }

  // null ratio across numeric columns
  const rows = result.rows;
  for (const col of result.columns) {
    let numeric = 0;
    let nulls = 0;
    let nonNull = 0;
    const samples: number[] = [];
    for (const r of rows.slice(0, 5000)) {
      const v = (r as Record<string, unknown>)[col];
      if (v == null || v === '') { nulls++; continue; }
      const s = String(v);
      const n = Number(v);
      // only cleanly-numeric strings (no phone/timestamp/id junk) count
      if (!Number.isNaN(n) && /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) {
        numeric++;
        samples.push(n);
      } else {
        nonNull++;
      }
    }
    if (rows.length > 0) {
      const nullRatio = nulls / rows.length;
      if (nullRatio > 0.5 && nullRatio < 1) {
        warn(`High null ratio in "${col}"`, `${(nullRatio * 100).toFixed(0)}% of rows are NULL. LLM summaries often mask this in metrics.`);
      } else if (nullRatio === 1) {
        warn(`Completely null column "${col}"`, 'Every row is NULL - the metric may be silently meaningless.');
      }
      if (numeric > 0 && isMetricColumn(col) && samples.length > 0) {
        const mn = Math.min(...samples);
        const mx = Math.max(...samples);
        if (samples.length > 1 && mn === mx) {
          warn(`Constant column "${col}"`, 'All values identical - a GROUP BY bug can manufacture flat numbers.');
        }
        if (mx > 1e12) {
          fail(`Implausible magnitude in "${col}"`, `Value up to ${mx.toExponential(2)} found - unit/scale error signature.`);
        }
      }
    }
  }

  // part-to-whole consistency gate (category breakdown)
  const bucketCol = result.columns.find((c) => c === 'bucket');
  const salesCol = result.columns.find((c) => c === 'sales');
  if (bucketCol && salesCol && rows.length >= 2) {
    const top = rows[0] ? Number((rows[0] as Record<string, unknown>)[salesCol] ?? 0) : 0;
    const total = rows.reduce((s, r) => s + Number((r as Record<string, unknown>)[salesCol] ?? 0), 0);
    if (total > 0 && top / total > 0.9) {
      fail('Monopoly concentration', `Top "${rows[0][bucketCol]}" holds ${((top / total) * 100).toFixed(1)}% of its group total - output looks single-row, double-count risk.`);
    }
  }

  // warehouse baselines (cheap, cached at module-level for 30s)
  try {
    const base = await baselines(db);
    metricsTotals.grossValue = base.gross;
    metricsTotals.orders = base.orders;
    metricsTotals.customers = base.customers;
    metricsTotals.refunds = base.refunds;

    // If the answer's own row count massively exceeds known orders, fail.
    const colId = result.columns.find((c) => c.toLowerCase().includes('id'));
    if (colId && base.orders != null && rows.length > base.orders * 1.5) {
      fail('Row count exceeds known order base', `${rows.length.toLocaleString()} rows vs ${base.orders.toLocaleString()} orders -- likely a cross join.`);
    }
    // If a numeric column implies a value vastly larger than the whole
    // warehouse GMV, record a scale-error signature (warning-level; the
    // semantic verifier already handles exact claim mismatches).
    for (const col of result.columns) {
      const row0 = rows[0] as Record<string, unknown> | undefined;
      const v = Number(row0?.[col] ?? NaN);
      if (Number.isFinite(v) && base.gross != null && base.gross > 0 && Math.abs(v) > base.gross * 20 && isMetricColumn(col)) {
        warn('Scale-error signature', `"${col}" = ${v.toLocaleString()} is ${(Math.abs(v) / base.gross).toFixed(1)}x the entire warehouse GMV -- suspicious unit scale.`);
      }
    }
  } catch {
    /* baseline best-effort */
  }

  if (!checks.some((c) => c.status !== 'passed')) {
    pass('Distribution sanity', 'No statistical red flags across results and baselines.');
  }

  return { checks, metricsTotals };
}

let _baseline: { at: number; gross: number; orders: number; customers: number; refunds: number } | null = null;

async function baselines(db: QueryEngine) {
  const now = Date.now();
  if (_baseline && now - _baseline.at < 30000) return _baseline;
  const [g, o, c, rf] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(total_amount),0) AS v FROM orders WHERE status <> 'cancelled'`),
    db.query(`SELECT COUNT(*) AS v FROM orders WHERE status <> 'cancelled'`),
    db.query(`SELECT COUNT(DISTINCT customer_id) AS v FROM orders WHERE status <> 'cancelled'`),
    db.query(`SELECT COALESCE(SUM(r.amount),0) AS v FROM refunds r JOIN orders o ON o.id=r.order_id`),
  ]);
  _baseline = {
    at: now,
    gross: num(g.rows[0]?.v),
    orders: num(o.rows[0]?.v),
    customers: num(c.rows[0]?.v),
    refunds: num(rf.rows[0]?.v),
  };
  return _baseline;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Heuristic guard: skip identifier/personal/temporal columns as numeric candidates. */
function isMetricColumn(col: string): boolean {
  return !/(^id$|_id$|phone|mobile|aadhaar|pincode|created|updated|date|time|.*_at$|email|name|status|reason|method|category|brand|tier|city|state|token|cvv|last4)/i.test(col);
}