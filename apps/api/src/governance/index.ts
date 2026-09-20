import fs from 'node:fs';
import path from 'node:path';
import type { Check, ColumnMeta, GovernancePolicy, PolicyRule } from '@vertexguard/shared';
import { defaultPolicy } from '@vertexguard/shared';
import { loadCatalog } from '../catalog/index';
import { dataDir } from '../paths';

const DATA_DIR = dataDir();
const POLICY_FILE = path.join(DATA_DIR, 'policy.json');

// ---------------------------------------------------------------------------
// Policy store
// ---------------------------------------------------------------------------

let cachedPolicy: GovernancePolicy | null = null;

export function readPolicy(): GovernancePolicy {
  if (cachedPolicy) return cachedPolicy;
  try {
    if (fs.existsSync(POLICY_FILE)) {
      cachedPolicy = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf-8')) as GovernancePolicy;
      return cachedPolicy;
    }
  } catch {
    /* fall through to default */
  }
  cachedPolicy = defaultPolicy();
  return cachedPolicy;
}

export function writePolicy(p: GovernancePolicy): GovernancePolicy {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  cachedPolicy = {
    ...p,
    version: (p.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(POLICY_FILE, JSON.stringify(cachedPolicy, null, 2));
  return cachedPolicy;
}

// ---------------------------------------------------------------------------
// Prompt-injection detector
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/\bignore\s+(all\s+)?(previous\s+)?(instructions|prompts|rules|orders)\b/i, '"ignore previous instructions" instruction prompt'],
  [/\b(disregard|forget)\s+(all\s+)?(previous|prior|earlier)\s+(instructions|prompts)\b/i, '"disregard earlier instructions" jailbreak'],
  [/\bsystem\s*(:| says)\s*.*you\s*are\b/i, 'system-prompt spoofing attempt'],
  [/\b(DAN|Do\s+Anything\s+Now|jailbreak|prompt\s*injection)\b/i, 'explicit jailbreak / injection keyword'],
  [/\b(reveal|show|expose|tell me)\b[\s\S]{0,40}\b(system prompt|hidden prompt|initial prompt|base prompt)\b/i, 'attempt to exfiltrate hidden prompt'],
  [/\b(skip|bypass|override|crack|unlock)\b[\s\S]{0,30}\b(security|policy|governance|access control|filter)\b/i, 'attempt to bypass governance controls'],
  [/\b(delete\s+from|drop\s+table|truncate\s+table|update\s+\w+\s+set\b|insert\s+into\s+\w+\s+.*values)\s*[;.\-]?/i, 'destructive SQL smuggling attempt'],
  [/\b(union\s+select|select.*\bfrom\b.*;|;.*\bselect\b|information_schema|pg_catalog)\b/i, 'SQL injection signature'],
  [/\b(sleep\s*\(|\bwaitfor\b.*\bdelay|benchmark\s*\()/i, 'time-delay attack signature'],
];

export function detectPromptInjection(question: string): { injected: boolean; score: number; matches: string[] } {
  const matches: string[] = [];
  for (const [re, label] of INJECTION_PATTERNS) {
    if (re.test(question)) matches.push(label);
  }
  return { injected: matches.length > 0, score: Math.min(100, matches.length * 45), matches };
}

// ---------------------------------------------------------------------------
// PII classifier for arbitrary sample values
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?91[- ]?\d{10}$|^0?\d{10}$/;
const NATIONAL_ID_RE = /^\d{12}$/; // Aadhaar-style
const NAME_RE = /^[A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})+$/;

export function classifyPii(value: unknown): { kind: string | null; sensitive: boolean } {
  if (value == null || value === '') return { kind: null, sensitive: false };
  const s = String(value);
  if (EMAIL_RE.test(s)) return { kind: 'email', sensitive: true };
  if (PHONE_RE.test(s)) return { kind: 'phone', sensitive: true };
  if (NATIONAL_ID_RE.test(s)) return { kind: 'national-id', sensitive: true };
  if (NAME_RE.test(s) && s.split(' ').length >= 2) return { kind: 'name', sensitive: true };
  return { kind: null, sensitive: false };
}

// ---------------------------------------------------------------------------
// Column-level access decision for the executor
// ---------------------------------------------------------------------------

export interface ColumnAccess {
  column: ColumnMeta;
  allowed: boolean;
  masked: boolean;
  rule: PolicyRule | undefined;
}

export function accessForColumn(policy: GovernancePolicy, role: string, tbl: string, col: ColumnMeta): ColumnAccess {
  const rule = colLookup(policy, role, tbl, col.name);
  if (rule) {
    if (rule.action === 'deny') return { column: col, allowed: false, masked: false, rule };
    if (rule.action === 'mask') return { column: col, allowed: true, masked: true, rule };
  }
  if (col.sensitivity === 'restricted') return { column: col, allowed: false, masked: false, rule: undefined };
  if (col.sensitivity === 'pii' || col.sensitivity === 'spi') {
    return { column: col, allowed: true, masked: true, rule: undefined };
  }
  return { column: col, allowed: true, masked: false, rule: undefined };
}

function colLookup(policy: GovernancePolicy, role: string, tbl: string, col: string): PolicyRule | undefined {
  for (const r of policy.rules) {
    if (!r.enabled) continue;
    if (r.role !== '*' && r.role !== role) continue;
    if (r.scope === 'column' && r.target === `${tbl}.${col}`) return r;
  }
  // table-level deny applies to every column of that table
  for (const r of policy.rules) {
    if (!r.enabled) continue;
    if (r.role !== '*' && r.role !== role) continue;
    if (r.scope === 'table' && r.target === tbl) return r;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Result redaction - masks sensitive column values
// ---------------------------------------------------------------------------

export function maskValue(piiKind: string | null, v: unknown): unknown {
  if (v == null || v === '') return '••••';
  const s = String(v);
  switch (piiKind) {
    case 'email': {
      const at = s.indexOf('@');
      if (at > -1) return `${s.slice(0, 1)}••••@${s.slice(at + 1)}`;
      return '••••@••••';
    }
    case 'phone':
      return s.replace(/^(.{3}).*(.{2})$/, '$1•••••••$2');
    case 'national-id':
      return `${s.slice(0, 4)} •••• •••${s.slice(-1)}`;
    case 'name':
      return s.split(' ').map((w, i) => (i === 0 ? w[0] + '•' : w[0] + '••')).join(' ');
    case 'financial':
      return `₹•••••`;
    default:
      return '••••';
  }
}

export { loadCatalog };

export function roleChecks(policy: GovernancePolicy, role: string, tables: string[]): Check[] {
  const checks: Check[] = [];
  for (const t of tables) {
    for (const r of policy.rules) {
      if (!r.enabled) continue;
      if (r.role !== '*' && r.role !== role) continue;
      if (r.scope === 'table' && r.target === t) {
        checks.push({
          id: `gov-tbl-${r.id}`,
          engine: 'governance',
          severity: 'critical',
          status: 'failed',
          title: `Table access denied: ${t}`,
          detail: `Policy ${r.id} (${r.role}) denies ${t} - ${r.reason}`,
        });
      }
    }
  }
  return checks;
}