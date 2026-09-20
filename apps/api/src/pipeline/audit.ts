import crypto from 'node:crypto';
import type { AuditFeed, GuardReport } from '@vertexguard/shared';
import type { QueryEngine } from '../db/engine';

export async function persistAudit(db: QueryEngine, report: GuardReport): Promise<void> {
  const g = (n: unknown) => (typeof n === 'number' ? n : n == null ? 0 : Number(n));
  await db.query(
    `INSERT INTO audit_runs
       (id, run_id, question, role, engine, verdict, trust_score, sql_text, fingerprint,
        check_count, failed_checks, verified_claims, mismatched_claims, answer_kind, executed_at, duration_ms, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      crypto.randomUUID(),
      report.runId,
      report.question,
      report.role,
      report.llmEngine,
      report.verdict,
      report.trustScore,
      report.sql,
      report.fingerprint,
      report.checks.length,
      report.checks.filter((c) => c.status === 'failed').length,
      report.verified.filter((v) => v.status === 'verified').length,
      report.verified.filter((v) => v.status === 'mismatch').length,
      report.answerKind,
      report.executedAt,
      Math.round(report.durationMs),
      JSON.stringify(report),
    ]
  );
}

export async function auditFeed(db: QueryEngine): Promise<AuditFeed> {
  const [runs, counts] = await Promise.all([
    db.query(
      `SELECT run_id, question, role, engine, verdict, trust_score, fingerprint,
              check_count, failed_checks, verified_claims, mismatched_claims, answer_kind, executed_at, duration_ms
         FROM audit_runs ORDER BY executed_at DESC LIMIT 50`
    ),
    db.query(
      `SELECT COALESCE(SUM(CASE WHEN verdict='verified' AND executed_at >= CURRENT_DATE THEN 1 ELSE 0 END),0) AS verified,
              COALESCE(SUM(CASE WHEN verdict='warn'      AND executed_at >= CURRENT_DATE THEN 1 ELSE 0 END),0) AS warned,
              COALESCE(SUM(CASE WHEN verdict='rejected'  AND executed_at >= CURRENT_DATE THEN 1 ELSE 0 END),0) AS rejected,
              COUNT(*) AS total
         FROM audit_runs`
    ),
  ]);
  const c = counts.rows[0];
  return {
    today: { verified: Number(c?.verified ?? 0), warned: Number(c?.warned ?? 0), rejected: Number(c?.rejected ?? 0) },
    total: Number(c?.total ?? 0),
    runs: runs.rows as unknown as AuditFeed['runs'],
  };
}