/**
 * Enhanced mock LLM engine — chatbot-friendly.
 *
 * Uses the agent's semantic NL-to-SQL compiler to answer ANY question,
 * then layers deterministic "silent failure syndromes" on top so the
 * Guardian pipeline can still demonstrate its value.
 *
 * Syndromes (by qh % 7):
 *   G trustworthy (control)     - assertion == ground truth
 *   A unit/scale error          - asserted value off by 10x
 *   B cancelled-order leak      - SQL forgets to exclude cancelled orders
 *   C refund double-count       - net revenue subtracts refunds twice
 *   D wrong time window         - "last 30 days" becomes a shifted window
 *   E aggregation swap          - says AVG, computes SUM (or vice versa)
 *   F hallucinated number       - asserted value is ~37% off + unverifiable claim
 */
import type { AnswerKind, Claim } from '@vertexguard/shared';
import type { QueryEngine } from '../db/engine';
import { planQuestion as agentPlan } from './agent';

export type Syndrome = 'G' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface Plan {
  intent: string;
  sql: string;
  explanation: string;
  aiExplanation?: string;
  claims: Claim[];
  llmConfidence: number;
  answerKind: AnswerKind;
  syndrome: Syndrome;
  note?: string;
  llmEngine?: string;
  followUps?: string[];
}

export interface QuestionAnswer {
  plan: Plan;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STATUS_FILTER = `o.status <> 'cancelled'`;

function normalizeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '\u20B9' + (n / 1e7).toFixed(2) + ' Cr';
  if (abs >= 1e5) return '\u20B9' + (n / 1e5).toFixed(2) + ' L';
  if (abs >= 1e3) return n.toLocaleString('en-IN');
  return String(n);
}

export async function planQuestion(db: QueryEngine, question: string, role: string): Promise<QuestionAnswer> {
  const qh = hash(question.trim().toLowerCase());

  // --- Use the agent's flexible semantic compiler as the base ---
  const agentResult = await agentPlan(db, question, role);
  const base = agentResult.plan;

  // --- Syndrome selection (deterministic from question hash) ---
  const s = qh % 7;
  const syndrome: Syndrome = s === 0 ? 'A' : s === 1 ? 'B' : s === 2 ? 'C' : s === 3 ? 'D' : s === 4 ? 'E' : s === 5 ? 'F' : 'G';

  // --- Compute asserted values for existing claims ---
  for (const c of base.claims) {
    if (!c.verifySql) continue;
    try {
      const r = await db.query(c.verifySql);
      const v = r.rows[0]?.value as number | undefined;
      c.assertedValue = normalizeNum(v);
    } catch {
      c.assertedValue = null;
    }
  }

  // --- Apply syndrome on top of the agent's answer ---
  let note: string | undefined = base.note;
  let executedSql = base.sql;

  if (syndrome !== 'G' && base.claims.length) {
    const firstNum = base.claims.find((c) => c.expectedKind === 'number' && typeof c.assertedValue === 'number');
    const num = firstNum ? (firstNum.assertedValue as number) : null;

    switch (syndrome) {
      case 'A':
        if (num != null) {
          firstNum!.assertedValue = Math.round(num * 10);
          firstNum!.assertion = `Gross figure ${fmt(num * 10)} (the model applied a x10 scale bug - asserting ${fmt(num * 10)} instead of ${fmt(num)}).`;
          note = 'unit/scale error';
        }
        break;

      case 'B':
        executedSql = executedSql.replace(` AND ${STATUS_FILTER}`, '').replace(`WHERE ${STATUS_FILTER}`, 'WHERE 1=1');
        for (const c of base.claims) {
          if (c.verifySql && !String(c.verifySql).includes('COUNT(DISTINCT')) {
            try {
              const r = await db.query(String(c.verifySql).replace(` AND ${STATUS_FILTER}`, '').replace(`WHERE ${STATUS_FILTER}`, 'WHERE 1=1'));
              c.assertedValue = normalizeNum(r.rows[0]?.value as number);
            } catch { /* keep */ }
          }
        }
        firstNum!.assertion = `Model omitted the "exclude cancelled orders" guard - inflating the figure with cancelled orders.`;
        note = 'cancelled-order leak';
        break;

      case 'C':
        if (num != null) {
          try {
            const refunds = await db.query(`SELECT COALESCE(SUM(r.amount),0) AS v FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.status IN ('delivered','returned')`);
            const rf = refunds.rows[0]?.v as number ?? 0;
            executedSql = executedSql.replace(
              /COALESCE\(SUM\(o\.total_amount\)/,
              `COALESCE(SUM(o.total_amount) - 2 * (${rf})`
            );
            for (const c of base.claims) {
              if (c.expectedKind === 'number' && typeof c.assertedValue === 'number') {
                c.assertedValue = Math.round((num - 2 * rf) * 100) / 100;
              }
            }
          } catch { /* keep */ }
          firstNum!.assertion = `Model double-counted refunds when computing net revenue (subtracted refunds twice).`;
          note = 'refund double-count';
        }
        break;

      case 'D':
        for (const c of base.claims) {
          if (c.verifySql && /INTERVAL/.test(String(c.verifySql))) {
            try {
              const r = await db.query(String(c.verifySql).replace(/INTERVAL '(\d+) days'/g, (_: string, n: string) => `INTERVAL '${+n * 2} days'`));
              c.assertedValue = normalizeNum(r.rows[0]?.value as number);
            } catch { /* keep */ }
          }
        }
        executedSql = executedSql.replace(/INTERVAL '(\d+) days'/g, (_: string, n: string) => `INTERVAL '${+n * 2} days'`);
        firstNum!.assertion = `Model misread the time window as double the requested span.`;
        note = 'wrong time window';
        break;

      case 'E':
        if (/AVG|average/i.test(base.sql)) {
          executedSql = executedSql.replace(/AVG\([^)]+\)/g, (m) => m.replace('AVG', 'SUM'));
          for (const c of base.claims) {
            if (c.verifySql && /AVG/.test(String(c.verifySql))) {
              try {
                const r = await db.query(String(c.verifySql).replace(/AVG\([^)]+\)/g, (m) => m.replace('AVG', 'SUM')));
                c.assertedValue = normalizeNum(r.rows[0]?.value as number);
              } catch { /* keep */ }
            }
          }
          firstNum!.assertion = `Question asked for the AVERAGE but the model computed the TOTAL - a classic aggregation swap.`;
          note = 'aggregation swap';
        } else if (/COUNT\(\*\)/i.test(base.sql)) {
          executedSql = executedSql.replace('COUNT(*)', 'SUM(1)');
          note = 'aggregation swap';
        }
        break;

      case 'F':
        if (num != null) {
          const wrong = Math.round(num * 0.63 * 100) / 100;
          const fclaim: Claim = {
            id: 'clm-hall', metric: 'Projected next-month growth',
            assertion: 'Based on the pattern, revenue will grow ~37% next month.',
            assertedValue: wrong, assertedUnit: '%',
            verifySql: '', expectedKind: 'number', tolerancePct: 0,
            labelForUi: 'Projected next-month growth (parametric guess)',
          };
          base.claims = [...base.claims, fclaim];
          firstNum!.assertion = `Model added a confident forecast that the warehouse cannot substantiate.`;
        }
        note = 'unverifiable projection';
        break;
    }
  }

  // --- Fill in assertion text for claims missing it ---
  for (const c of base.claims) {
    if (!c.assertion) {
      const v = typeof c.assertedValue === 'number' ? fmt(c.assertedValue) : (c.assertedValue ?? '-');
      c.assertion = `${c.metric} \u2248 ${v} ${c.assertedUnit}.`;
    }
  }

  const llmConfidence =
    syndrome === 'G' ? 0.96 + (qh % 3) * 0.01
      : syndrome === 'F' ? 0.91 + (qh % 4) * 0.01
        : 0.88 + (qh % 4) * 0.02;

  return {
    plan: {
      intent: base.intent,
      sql: executedSql,
      explanation: base.explanation,
      aiExplanation: base.aiExplanation,
      claims: base.claims,
      llmConfidence,
      answerKind: base.answerKind,
      syndrome,
      note,
      llmEngine: base.llmEngine ?? 'VertexGuard Mock Agent (Syndrome Demo)',
      followUps: base.followUps,
    },
  };
}
