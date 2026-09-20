/**
 * VertexGuard shared domain types.
 * Every LLM-generated analytical answer passes the Guardian pipeline and is
 * emitted to clients as a structured, auditable "guard report".
 */

// ---------------------------------------------------------------------------
// Pipeline events (WebSocket)
// ---------------------------------------------------------------------------

export type PipelineStage =
  | 'planning'      // LLM turns the question into SQL + claims
  | 'guard'         // static SQL security / safety scan
  | 'governance'    // PII, role policy, injection checks
  | 'execution'     // query runs against the warehouse
  | 'verification'  // each claim recomputed against ground truth
  | 'statistics'    // statistical anomaly audit
  | 'report'        // trust score + final verdict
  | 'persisted';    // saved to audit log

export type StageStatus = 'running' | 'passed' | 'failed' | 'warned';

export interface StageEvent {
  kind: 'stage';
  runId: string;
  stage: PipelineStage;
  status: StageStatus;
  startedAt: number;
  durationMs?: number;
  detail?: string;
}

export interface HeartbeatEvent {
  kind: 'heartbeat';
  runId: string;
  t: number;
}

export type PipelineEvent = StageEvent | HeartbeatEvent;

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export type Sensitivity =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'pii'
  | 'spi'
  | 'restricted';

export interface TableMeta {
  name: string;
  kind: 'fact' | 'dimension';
  description: string;
  sensitivity: Sensitivity;
  columns: ColumnMeta[];
}

export interface ColumnMeta {
  name: string;
  type: string;
  sensitivity: Sensitivity;
  piiKind: string | null;
  nullable: boolean;
  description: string;
  sample?: string;
}

// ---------------------------------------------------------------------------
// Governance / policies
// ---------------------------------------------------------------------------

export type CheckSeverity = 'info' | 'warning' | 'critical';

export interface PolicyRule {
  id: string;
  role: string;
  action: 'allow' | 'deny' | 'mask';
  scope: 'table' | 'column';
  target: string; // table or table.column
  reason: string;
  enabled: boolean;
}

export interface GovernancePolicy {
  version: number;
  updatedAt: string;
  rules: PolicyRule[];
}

export function defaultPolicy(): GovernancePolicy {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    rules: [
      {
        id: 'pol-deny-prod',
        role: '*',
        action: 'deny',
        scope: 'table',
        target: 'payments',
        reason: 'Raw payment card data is out of scope for NL analytics.',
        enabled: true,
      },
      {
        id: 'pol-mask-aadhaar',
        role: 'analyst',
        action: 'mask',
        scope: 'column',
        target: 'customers.aadhaar',
        reason: 'National ID number - must be masked in all output.',
        enabled: true,
      },
      {
        id: 'pol-mask-email',
        role: 'analyst',
        action: 'mask',
        scope: 'column',
        target: 'customers.email',
        reason: 'Personal contact - mask to local-part@… on output.',
        enabled: true,
      },
    ],
  };
}

export function rulePresent(
  policy: GovernancePolicy,
  role: string,
  table: string,
  column?: string
): PolicyRule | undefined {
  for (const r of policy.rules) {
    if (!r.enabled) continue;
    if (r.role !== '*' && r.role !== role) continue;
    if (r.scope === 'table' && r.target === table) return r;
    if (r.scope === 'column' && r.target === `${table}.${column}`) return r;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Claims - the "synthetic plausible values" LLMs assert
// ---------------------------------------------------------------------------

export interface Claim {
  id: string;
  metric: string;       // human metric name
  assertion: string;    // the natural-language assertion (what the LLM said)
  assertedValue: number | string | null;
  assertedUnit: string;
  verifySql: string;    // SQL that recomputes ground truth
  expectedKind: 'number' | 'string' | 'date' | 'boolean';
  tolerancePct: number; // acceptable relative tolerance vs ground truth
  labelForUi: string;
}

export interface VerificationResult {
  claimId: string;
  metric: string;
  assertedValue: number | string | null;
  assertedUnit: string;
  groundTruth: number | string | null;
  deltaPct: number | null;    // |a-g|/|g| * 100 (null if g is 0/empty)
  withinTolerance: boolean;
  status: 'verified' | 'mismatch' | 'unverifiable' | 'sensitive';
  reason: string;
}

// ---------------------------------------------------------------------------
// Checks - guardian + governance + statistics results
// ---------------------------------------------------------------------------

export interface Check {
  id: string;
  engine: 'guard' | 'governance' | 'verification' | 'statistics';
  severity: CheckSeverity;
  status: 'passed' | 'warned' | 'failed';
  title: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Guard report - the verified answer
// ---------------------------------------------------------------------------

export type Verdict = 'verified' | 'warn' | 'rejected';
export type AnswerKind = 'metric' | 'table' | 'insight' | 'rejected';

export interface ExecutedResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

export interface MetricsTotals {
  grossValue: number | null;
  orders: number | null;
  customers: number | null;
  refunds: number | null;
}

export interface GuardReport {
  runId: string;
  question: string;
  role: string;
  sql: string;
  sqlSanitized: string;   // for display (masked substrings)
  intent: string;
  llmEngine: string;
  llmConfidence: number;  // simulated self-reported confidence
  verified: VerificationResult[];
  checks: Check[];
  result: ExecutedResult | null;
  metricsTotals: MetricsTotals;
  trustScore: number;     // 0..100
  verdict: Verdict;
  answerKind: AnswerKind;
  answerSummary: string;
  aiExplanation?: string;
  followUps?: string[];
  fingerprint: string;    // SHA-256 of canonical pipeline artifacts
  executedAt: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditRun {
  id: string;
  runId: string;
  question: string;
  role: string;
  engine: string;
  verdict: Verdict;
  trustScore: number;
  sql: string;
  fingerprint: string;
  checkCount: number;
  failedChecks: number;
  verifiedClaims: number;
  mismatchedClaims: number;
  answerKind: AnswerKind;
  executedAt: string;
  durationMs: number;
}

export interface AuditFeed {
  today: { verified: number; warned: number; rejected: number };
  total: number;
  runs: AuditRun[];
}

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

export interface AnalyzeRequest {
  question: string;
  role?: string;
}

export interface CatalogResponse {
  tables: TableMeta[];
  applied: GovernancePolicy;
  role: string;
}

export interface PolicyUpdatePayload {
  rules: PolicyRule[];
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export const STAGES_ORDER: PipelineStage[] = [
  'planning',
  'guard',
  'governance',
  'execution',
  'verification',
  'statistics',
  'report',
  'persisted',
];

export function stagesBefore(s: PipelineStage): PipelineStage[] {
  return STAGES_ORDER.slice(0, STAGES_ORDER.indexOf(s) + 1);
}