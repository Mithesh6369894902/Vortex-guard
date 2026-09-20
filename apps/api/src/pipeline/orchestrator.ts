import { readPolicy } from '../governance/index';
import { planQuestion } from '../llm/index';
import { runGuard, sanitizeForDisplay } from '../guard/index';
import { guardAndExecute } from './execute';
import { verifyClaims } from '../verifier/index';
import { runStatisticalGuard } from '../statistics/index';
import { fingerprint } from './fingerprint';
import { persistAudit } from './audit';
import { hub } from './hub';
import type { QueryEngine } from '../db/engine';
import type { Check, GuardReport, PipelineStage, VerificationResult } from '@vertexguard/shared';

type ResultStatus = 'passed' | 'failed' | 'warned';

async function stage<E>(
  db: QueryEngine,
  runId: string,
  s: PipelineStage,
  work: () => Promise<{ status: ResultStatus; detail?: string; value: E }>
): Promise<{ status: ResultStatus; detail?: string; value: E }> {
  const startedAt = Date.now();
  hub().broadcast({ kind: 'stage', runId, stage: s, status: 'running', startedAt });
  const out = await work();
  hub().broadcast({
    kind: 'stage',
    runId,
    stage: s,
    status: out.status,
    startedAt,
    durationMs: Date.now() - startedAt,
    detail: out.detail,
  });
  void db;
  return out;
}

export interface AnalyzeCtx {
  question: string;
  role: string;
  runId: string;
}

export async function runAnalysis(db: QueryEngine, ctx: AnalyzeCtx): Promise<GuardReport> {
  const started = Date.now();
  const { runId } = ctx;
  const checks: Check[] = [];
  const policy = readPolicy();

  // --- planning ------------------------------------------------------------------
  let planned = null as Awaited<ReturnType<typeof planQuestion>>['plan'] | null;
  const planOut = await stage(db, runId, 'planning', async () => {
    const out = await planQuestion(db, ctx.question, ctx.role);
    planned = out.plan;
    const detail = `Intent="${out.plan.intent}" · Engine="${out.plan.llmEngine ?? 'AI Agent'}" · self-confidence ${(out.plan.llmConfidence * 100).toFixed(0)}%`;
    checks.push({ id: 'plan-intent', engine: 'verification', severity: 'info', status: 'passed', title: `Intent recognized: ${out.plan.intent}`, detail });
    return { status: 'passed' as const, value: out, detail };
  });

  const sql = planned?.sql ?? '';
  const guardOut = sql ? runGuard(sql) : { green: true, checks: [] as Check[], tables: [] as string[], columns: [] as string[], hasLimit: false, isSelectOnly: true };
  checks.push(...guardOut.checks);

  await stage(db, runId, 'guard', async () => ({
    status: guardOut.green ? 'passed' : 'failed',
    value: guardOut,
    detail: guardOut.isSelectOnly ? 'Single read-only SELECT - no mutating constructs.' : 'Static analysis blocked the query.',
  }));

  // --- governance + execution -------------------------------------------------------
  const { decision, result, execChecks } = await guardAndExecute(
    db,
    planned ?? { intent: 'total_value', sql: '', explanation: '', claims: [], llmConfidence: 0, answerKind: 'metric', syndrome: 'G', note: '' },
    ctx.role,
    policy,
    guardOut.columns
  );
  checks.push(...decision.checks, ...execChecks);

  await stage(db, runId, 'governance', async () => ({
    status: decision.checks.some((c) => c.status === 'failed') ? 'failed' : 'passed',
    value: decision,
    detail: decision.injected
      ? 'Prompt-injection - pipeline halted.'
      : decision.maskedColumns.size
        ? `${decision.maskedColumns.size} sensitive column(s) masked on output.`
        : 'No sensitive data exposed.',
  }));

  const execStatus: ResultStatus = decision.doNotExecute
    ? decision.injected
      ? 'failed'
      : result === null && planned?.sql
        ? 'failed'
        : 'warned'
    : 'passed';

  const execOut = await stage(db, runId, 'execution', async () => ({
    status: execStatus,
    value: result,
    detail: result ? `${result.rowCount.toLocaleString()} row(s) returned${result.truncated ? ' (truncated)' : ''}` : 'No execution performed.',
  }));

  // --- verification -------------------------------------------------------------------
  let verified: VerificationResult[] = [];
  let verifyStage: ResultStatus = 'warned';
  let verifyDetail = '';
  if (planned?.claims.length) {
    const r = await stage(db, runId, 'verification', async () => {
      const { results, checks: vChecks } = await verifyClaims(db, planned!.claims);
      verified = results;
      checks.push(...vChecks);
      const bad = results.filter((x) => x.status !== 'verified').length;
      return { status: (bad === 0 ? 'passed' : 'failed') as ResultStatus, value: results, detail: `${results.length} claim(s) - ${results.length - bad} verified, ${bad} failed.` };
    });
    verifyStage = r.status;
    verifyDetail = r.detail ?? '';
  } else {
    checks.push({
      id: 'ver-none',
      engine: 'verification',
      severity: 'warning',
      status: 'warned',
      title: 'No metric claims independently asserted',
      detail: 'This is a raw-row / visual answer with no asserted numeric claims. Treat any numeric takeaways as unverified.',
    });
    verifyStage = 'warned';
    verifyDetail = 'No metric claims to prove (raw/row answer).';
  }

  // --- statistics ----------------------------------------------------------------------
  const statsOut = await stage(db, runId, 'statistics', async () => {
    const out = await runStatisticalGuard(db, result, ctx.question);
    checks.push(...out.checks);
    const bad = out.checks.filter((c) => c.status !== 'passed').length;
    return { status: (bad === 0 ? 'passed' : bad > 1 ? 'failed' : 'warned') as ResultStatus, value: out, detail: `${out.checks.length} statistical probes, ${bad} flagged.` };
  });

  // --- scoring & verdict ------------------------------------------------------------------
  const critical = checks.filter((c) => c.severity === 'critical').length;
  const warnings = checks.filter((c) => c.severity === 'warning').length;
  let trustScore = Math.max(0, 100 - critical * 30 - warnings * 10);
  if (verified.length && verified.every((v) => v.status === 'verified')) trustScore = Math.max(trustScore, 96);
  if (verified.some((v) => v.status === 'unverifiable')) trustScore = Math.min(trustScore, 30);
  if (verified.some((v) => v.status === 'mismatch')) trustScore = Math.min(trustScore, 40);

  const verdict = critical > 0 || verifyStage === 'failed'
    ? 'rejected'
    : trustScore >= 92 && verifyStage === 'passed'
      ? 'verified'
      : 'warn';

  const report: GuardReport = {
    runId,
    question: ctx.question,
    role: ctx.role,
    sql: sql || '(none - policy-halted)',
    sqlSanitized: sql ? sanitizeForDisplay(sql) : '',
    intent: planned?.intent ?? 'unknown',
    llmEngine: planned?.llmEngine ?? 'VertexGuard AI Agent',
    llmConfidence: planned?.llmConfidence ?? 0.95,
    verified,
    checks,
    result,
    metricsTotals: statsOut.value?.metricsTotals ?? { grossValue: null, orders: null, customers: null, refunds: null },
    trustScore: Math.round(trustScore),
    verdict,
    answerKind: planned?.answerKind ?? 'rejected',
    answerSummary: buildSummary(planned, verified, verdict, result),
    aiExplanation: planned?.aiExplanation ?? planned?.explanation,
    followUps: planned?.followUps,
    fingerprint: fingerprint([ctx.question, sql, planned?.claims ?? [], verified, checks.map((c) => ({ s: c.status, sev: c.severity }))]),
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };

  await stage(db, runId, 'report', async () => ({
    status: verdict === 'verified' ? 'passed' : verdict === 'warn' ? 'warned' : 'failed',
    value: report,
    detail: `Trust score ${report.trustScore}/100 → ${verdict.toUpperCase()}.`,
  }));

  try {
    await persistAudit(db, report);
  } catch (e) {
    checks.push({ id: 'audit-warn', engine: 'verification', severity: 'warning', status: 'warned', title: 'Audit write failed', detail: String((e as Error).message).split('\n')[0] });
    report.checks = checks;
  }

  await stage(db, runId, 'persisted', async () => ({ status: 'passed', value: report, detail: 'Report anchored into the tamper-evident audit trail.' }));

  return report;
}

function buildSummary(p: Awaited<ReturnType<typeof planQuestion>>['plan'] | null, verified: VerificationResult[], verdict: GuardReport['verdict'], result: GuardReport['result']): string {
  if (!p) return 'The planning engine could not interpret this request.';
  if (p.intent === 'forbidden_payments') return 'Blocked: the payments table is restricted by corporate policy. Card data is never served.';
  if (p.intent === 'out_of_scope') return 'Rejected: the answer would rely on parametric memory, not warehouse evidence. No fabricated metric passed the gate.';
  if (p.intent === 'app_knowledge' || p.intent === 'general_chat') return p.explanation;

  if (verdict === 'rejected') {
    const m = verified.find((v) => v.status === 'mismatch' || v.status === 'unverifiable');
    if (m) return `Rejected: model asserted "${m.metric}" but warehouse ground truth disagrees. The plausible-looking number did not survive verification.`;
    return 'Rejected: the answer failed the verification / governance gate.';
  }
  if (verdict === 'verified' && verified.some((v) => v.status === 'verified')) {
    const bits = verified.filter((v) => v.status === 'verified').map((v) => `${v.metric} ≈ ${v.groundTruth ?? v.assertedValue} ${v.assertedUnit}`).join(' · ');
    return `Verified against warehouse ground truth - ${bits}.`;
  }
  if (verdict === 'verified') return 'Verified pipeline - nothing contradicted by the warehouse.';
  if (result?.rowCount) return `Data returned (${result.rowCount.toLocaleString()} rows) with flagged checks - review before using.`;
  return 'Approved with warnings - review the flagged checks before decision-making.';
}