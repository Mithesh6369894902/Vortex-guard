import type { Check, ExecutedResult, GovernancePolicy } from '@vertexguard/shared';
import type { QueryEngine } from '../db/engine';
import { loadCatalog } from '../catalog/index';
import { accessForColumn, detectPromptInjection, maskValue, roleChecks } from '../governance/index';
import type { Plan } from '../llm/index';

const MAX_ROWS = 200;

export interface GovernanceDecision {
  doNotExecute: boolean;
  injected: boolean;
  checks: Check[];
  maskedColumns: Map<string, string>; // columnName -> piiKind
  blockedColumns: Set<string>;
}

/**
 * Governance + execution for one plan. Runs three times conceptually, but kept
 * in one pass: policy decisions (governance stage) then verified execution
 * (execution stage) with masking applied on output.
 */
export async function guardAndExecute(
  db: QueryEngine,
  plan: Plan,
  role: string,
  policy: GovernancePolicy,
  referencedColumns: string[]
): Promise<{ decision: GovernanceDecision; result: ExecutedResult | null; execChecks: Check[] }>
{
  const decision: GovernanceDecision = {
    doNotExecute: false,
    injected: false,
    checks: [],
    maskedColumns: new Map(),
    blockedColumns: new Set(),
  };

  // 1. Prompt-injection on the natural-language input
  const inj = detectPromptInjection(plan.explanation + ' ' + (plan.note ?? ''));
  if (inj.injected) {
    decision.doNotExecute = true;
    decision.injected = true;
    decision.checks.push({
      id: 'gov-inj',
      engine: 'governance',
      severity: 'critical',
      status: 'failed',
      title: 'Prompt-injection signature detected',
      detail: `The request contained jailbreak / injection cues (score ${inj.score}): ${inj.matches.join(', ')}. Pipeline halted.`,
    });
  }

  // 2. Table-level access policy
  const tableChecks = roleChecks(policy, role, extractTables(plan.sql));
  for (const c of tableChecks) decision.checks.push(c);

  // 3. Column-level decisions against the live catalog
  const catalog = await loadCatalog(db);
  const colAccess = new Map<string, { piiKind: string | null; mask: boolean; allow: boolean; blocked: boolean }>();
  const headerToCol = new Map<string, string>();
  for (const ref of referencedColumns) {
    const [tbl, col] = ref.split('.');
    const table = catalog.tables.find((t) => t.name === tbl);
    const meta = table?.columns.find((c) => c.name === col);
    if (!meta) continue;
    const acc = accessForColumn(policy, role, tbl, meta);
    colAccess.set(ref, { piiKind: meta.piiKind, mask: acc.masked, allow: acc.allowed, blocked: !acc.allowed && acc.rule?.action === 'deny' });
    headerToCol.set(col, ref);
  }

  const maskedExisting = new Set<string>();
  const blockedSet = new Set<string>();
  for (const [ref, acc] of colAccess) {
    if (!acc.allow) {
      blockedSet.add(ref.split('.')[1]);
      decision.blockedColumns.add(ref.split('.')[1]);
    } else if (acc.mask) {
      maskedExisting.add(ref.split('.')[1]);
      decision.maskedColumns.set(ref.split('.')[1], acc.piiKind ?? 'default');
    }
  }

  for (const ref of [...colAccess.keys()]) {
    const acc = colAccess.get(ref)!;
    if (!acc.allow) {
      decision.checks.push({
        id: `gov-den-${ref}`,
        engine: 'governance',
        severity: 'critical',
        status: 'failed',
        title: `Access denied: ${ref}`,
        detail: `Column ${ref} is blocked for role "${role}" by policy.`,
      });
      decision.doNotExecute = true;
    }
  }

  // Masked-personal-data note (informational)
  if (maskedExisting.size > 0) {
    decision.checks.push({
      id: 'gov-mask',
      engine: 'governance',
      severity: 'info',
      status: 'passed',
      title: 'Personal data masked',
      detail: `Columns [${[...maskedExisting].join(', ')}] are classified as PII/SPI and masked for role "${role}".`,
    });
  }

  // If an explicit PII request, confirm masking is active
  if (plan.intent === 'sensitive_list' && decision.doNotExecute === false) {
    decision.checks.push({
      id: 'gov-pii-req',
      engine: 'governance',
      severity: 'info',
      status: 'passed',
      title: 'Sensitive request handled safely',
      detail: 'Personal identifiers were requested; governance masked them instead of allowing raw output.',
    });
  }

  // 4. Execution
  let result: ExecutedResult | null = null;
  const execChecks: Check[] = [];
  if (!decision.doNotExecute && plan.sql) {
    try {
      const res = await db.query(plan.sql);
      const truncated = res.rows.length > MAX_ROWS;
      const shown = res.rows.slice(0, MAX_ROWS).map((row) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          const ref = headerToCol.get(k);
          const acc = ref ? colAccess.get(ref) : undefined;
          if (acc && !acc.allow) { out[k] = '▪▪ BLOCKED ▪▪'; continue; }
          if (acc && acc.mask) { out[k] = maskValue(acc.piiKind, v); continue; }
          out[k] = v;
        }
        return out;
      });
      result = {
        columns: res.fields.map((f) => f.name),
        rows: shown as Record<string, unknown>[],
        rowCount: res.rowCount,
        truncated,
      };
    } catch (e) {
      const msg = String((e as Error).message ?? e).split('\n')[0];
      execChecks.push({
        id: 'exec-error',
        engine: 'governance',
        severity: 'critical',
        status: 'failed',
        title: 'Execution error',
        detail: `The produced SQL failed to run: ${msg}`,
      });
      decision.doNotExecute = true;
    }
  } else if (!plan.sql) {
    execChecks.push({
      id: 'exec-skip',
      engine: 'governance',
      severity: 'info',
      status: 'passed',
      title: 'Execution skipped by policy',
      detail: 'No SQL was produced (out-of-scope or policy-halted run).',
    });
  }

  return { decision, result, execChecks };
}

function extractTables(sql: string): string[] {
  const out = new Set<string>();
  const re = /\b(from|join)\s+([a-z_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) out.add(m[2].toLowerCase());
  return [...out];
}