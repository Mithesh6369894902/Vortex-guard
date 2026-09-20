import type { Check, Claim, VerificationResult } from '@vertexguard/shared';
import type { QueryEngine } from '../db/engine';

/**
 * Semantic verifier: recomputes the ground truth for every claim the LLM
 * asserted, and compares it to what the model "said". This is the core
 * countermeasure for the Silent Failure trap - plausible numbers must
 * prove themselves against the warehouse, with tolerance.
 */
export async function verifyClaims(db: QueryEngine, claims: Claim[]): Promise<{ results: VerificationResult[]; checks: Check[] }> {
  const results: VerificationResult[] = [];
  const checks: Check[] = [];

  for (const c of claims) {
    if (!c.verifySql) {
      const r: VerificationResult = {
        claimId: c.id,
        metric: c.metric,
        assertedValue: c.assertedValue,
        assertedUnit: c.assertedUnit,
        groundTruth: null,
        deltaPct: null,
        withinTolerance: false,
        status: 'unverifiable',
        reason: 'No warehouse-backed verification SQL exists for this claim (parametric/hallucinated knowledge).',
      };
      results.push(r);
      checks.push({
        id: `ver-unv-${c.id}`,
        engine: 'verification',
        severity: 'critical',
        status: 'failed',
        title: `Unverifiable claim: ${c.metric}`,
        detail: r.reason,
      });
      continue;
    }

    let groundTruth: number | string | null = null;
    let computeError: string | null = null;
    try {
      const res = await db.query(c.verifySql);
      groundTruth = normalize(res.rows[0]?.value);
    } catch (e) {
      computeError = String((e as Error).message ?? e).split('\n')[0];
    }

    if (computeError) {
      results.push({
        claimId: c.id, metric: c.metric,
        assertedValue: c.assertedValue, assertedUnit: c.assertedUnit, groundTruth: null, deltaPct: null,
        withinTolerance: false, status: 'unverifiable',
        reason: `Verification query failed: ${computeError}`,
      });
      checks.push({ id: `ver-err-${c.id}`, engine: 'verification', severity: 'critical', status: 'failed', title: `Verification error: ${c.metric}`, detail: `Ground-truth query errored: ${computeError}` });
      continue;
    }

    const asserted = c.assertedValue;
    let deltaPct: number | null = null;
    let matches = false;
    let reason = '';

    if (c.expectedKind === 'number') {
      const a = typeof asserted === 'number' ? asserted : Number(asserted);
      const g = typeof groundTruth === 'number' ? groundTruth : Number(groundTruth);
      if (!Number.isFinite(a) || !Number.isFinite(g) || g === null) {
        matches = false;
        reason = 'Ground truth is empty or non-numeric - claim cannot be confirmed.';
      } else if (g === 0) {
        matches = a === 0;
        deltaPct = a === 0 ? 0 : null;
        reason = matches ? 'Matches (both zero).' : 'True value is 0 but the model asserted a non-zero figure.';
      } else {
        deltaPct = Math.abs((a - g) / g) * 100;
        matches = deltaPct <= c.tolerancePct;
        reason = matches
          ? `Within tolerance (Δ ${deltaPct.toFixed(2)}% ≤ ${c.tolerancePct}%).`
          : `Mismatch: model said ${a}, warehouse shows ${g} (Δ ${deltaPct.toFixed(2)}%, tolerance ${c.tolerancePct}%).`;
      }
    } else {
      // string / date / boolean
      const a = String(asserted ?? '').trim().toLowerCase();
      const g = String(groundTruth ?? '').trim().toLowerCase();
      matches = a === g && a !== '';
      reason = matches ? 'Matches ground truth.' : `Mismatch: model said "${asserted}", warehouse shows "${groundTruth}".`;
      if (a === '' || g === '') {
        matches = false;
        reason = 'Ground truth or assertion is empty - claim cannot be confirmed.';
      }
    }

    const status: VerificationResult['status'] = matches ? 'verified' : 'mismatch';
    const r: VerificationResult = {
      claimId: c.id,
      metric: c.metric,
      assertedValue: c.assertedValue,
      assertedUnit: c.assertedUnit,
      groundTruth,
      deltaPct: deltaPct != null ? Math.round(deltaPct * 100) / 100 : null,
      withinTolerance: matches,
      status,
      reason,
    };
    results.push(r);

    checks.push({
      id: `ver-${status}-${c.id}`,
      engine: 'verification',
      severity: status === 'verified' ? 'info' : 'critical',
      status: status === 'verified' ? 'passed' : 'failed',
      title: `${status === 'verified' ? 'Verified' : 'Mismatch'}: ${c.metric}`,
      detail: reason,
    });
  }

  return { results, checks };
}

function normalize(v: unknown): number | string | null {
  if (v == null) return null;
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  const n = Number.parseFloat(s);
  if (!Number.isNaN(n) && String(s).trim() === String(n)) return n;
  return s;
}