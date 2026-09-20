import { useState } from 'react';
import type { Check, GuardReport } from '@vertexguard/shared';
import {
  ShieldCheck, ShieldAlert, ShieldX, Fingerprint, Timer, ChevronDown, ChevronUp,
  Database, Scale, UserCheck, ChartNoAxesCombined, CheckCircle2, XCircle, AlertTriangle,
  EyeOff, Table2, Copy, Check as CheckIcon, Sparkles, ArrowUpRight
} from 'lucide-react';
import { formatNumber, formatINR, formatDuration, formatTime, shortFingerprint } from '../lib/format';

const ENGINE_META = {
  guard: { label: 'SQL Guardian', Icon: ShieldCheck, color: 'text-positivus-dark', bg: 'bg-positivus-green' },
  governance: { label: 'Governance & PII', Icon: UserCheck, color: 'text-positivus-dark', bg: 'bg-white' },
  verification: { label: 'Semantic Verifier', Icon: Scale, color: 'text-positivus-dark', bg: 'bg-positivus-green' },
  statistics: { label: 'Statistical Audit', Icon: ChartNoAxesCombined, color: 'text-positivus-dark', bg: 'bg-amber-300' },
} as const;

function fmtCell(v: unknown): string {
  if (v == null) return '∅';
  if (typeof v === 'number') return formatNumber(v);
  return String(v);
}

function isMasked(v: unknown): boolean {
  return typeof v === 'string' && (v.includes('…') || v === '***' || v === '[REDACTED]' || v.startsWith('••'));
}

function isMoney(col: string, v: unknown): boolean {
  return typeof v === 'number' && /(price|gross|amount|revenue|sales|value|total|cost)/i.test(col);
}

export function ResultCard({ report, onSelectQuestion }: { report: GuardReport; onSelectQuestion?: (q: string) => void }) {
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const gp = report.result?.columns.filter((c) => !c.startsWith('__m'));
  const vc = report.result?.columns.filter((c) => c.startsWith('__m'));
  const maxColumns = gp?.length ?? 0;
  const cols = report.result && (showAllColumns || gp!.length <= 6 ? gp! : gp!.slice(0, 6));
  const hideCols = report.result && !showAllColumns && (gp?.length ?? 0) > 6;
  const clawedly = vc && vc.length > 0;

  return (
    <div className="pl-4 md:pl-10 max-w-full">
      <div className="card-positivus-white overflow-hidden p-0">
        {/* Header strip */}
        <div className="p-5 md:p-6 bg-positivus-grey border-b border-positivus-dark flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <TrustRing score={report.trustScore} verdict={report.verdict} />
            <div>
              <div className="text-base md:text-lg font-bold text-positivus-dark leading-snug">
                {report.answerSummary}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 mt-1.5 font-medium">
                <span className="flex items-center gap-1.5"><Timer size={13} /> {formatDuration(report.durationMs)}</span>
                <span className="flex items-center gap-1.5">
                  <Fingerprint size={13} /> Anchor: <span className="mono font-bold text-positivus-dark">{shortFingerprint(report.fingerprint)}</span>
                </span>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(report.fingerprint);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                  className="flex items-center gap-1 font-bold text-positivus-dark underline hover:text-positivus-muted"
                >
                  {copied ? <CheckIcon size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <span>{formatTime(report.executedAt)}</span>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 bg-white border border-positivus-dark rounded-xl px-3 py-1.5 text-xs font-bold text-positivus-dark shadow-positivus-sm">
            <span>{report.llmEngine}</span>
            <span className="bg-positivus-green px-1.5 py-0.5 rounded text-[11px]">{(report.llmConfidence * 100).toFixed(0)}% conf</span>
          </div>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          {/* AI Conversational Reasoning */}
          {report.aiExplanation && (
            <div className="rounded-2xl border border-positivus-dark bg-positivus-green/20 p-4 md:p-5 flex items-start gap-3.5 shadow-positivus-sm">
              <div className="w-8 h-8 rounded-full bg-positivus-dark text-positivus-green flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-positivus-dark">
                  AI Analyst Interpretation
                </div>
                <div className="text-sm md:text-[15px] font-medium text-positivus-dark mt-1 leading-relaxed">
                  {report.aiExplanation}
                </div>
              </div>
            </div>
          )}

          {/* Claims verification table */}
          {report.verified.length > 0 && <ClaimsTable report={report} />}

          {/* Checks section */}
          <ChecksSection checks={report.checks} />

          {/* Result data table */}
          {report.result && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-positivus-dark">
                  <Table2 size={16} /> Verified Result Table
                </div>
                <button
                  onClick={() => setShowSql((s) => !s)}
                  className="flex items-center gap-1.5 text-xs font-bold text-positivus-dark bg-positivus-grey hover:bg-positivus-green border border-positivus-dark rounded-xl px-3 py-1.5 transition"
                >
                  {showSql ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{showSql ? 'Hide SQL' : 'View SQL'}</span>
                </button>
              </div>

              {/* Masked columns notice */}
              {clawedly && (
                <div className="flex items-center gap-2 text-xs font-bold text-positivus-dark bg-amber-100 border border-positivus-dark rounded-xl px-3 py-2 mb-3 shadow-positivus-sm">
                  <EyeOff size={14} />
                  <span>{vc.length} column{vc.length > 1 ? 's' : ''} masked by compliance policy ({vc.join(', ')})</span>
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-positivus-dark shadow-positivus-sm bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-positivus-dark text-white">
                    <tr>
                      {cols!.map((c) => (
                        <th key={c} className="px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                          {c.replace(/^__m/, '')}
                        </th>
                      ))}
                      {hideCols && <th className="px-4 py-3 text-xs font-medium text-positivus-green">+{maxColumns - 6} more</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {report.result.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-positivus-grey/60 transition">
                        {cols!.map((c) => {
                          const v = r[c];
                          return (
                            <td key={c} className={`px-4 py-3 whitespace-nowrap text-sm ${isMasked(v) ? 'font-mono text-fuchsia-700 font-bold' : isMoney(c, v) ? 'font-mono font-bold text-positivus-dark' : 'font-medium text-zinc-800'}`}>
                              {isMasked(v) ? String(v) : isMoney(c, v) ? formatINR(v as number) : fmtCell(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-zinc-600 font-medium mt-2 flex items-center justify-between">
                <span>
                  {report.result.rowCount.toLocaleString()} row{report.result.rowCount !== 1 ? 's' : ''} returned
                  {report.result.truncated ? ' (display sample)' : ''}
                </span>
                {hideCols && (
                  <button onClick={() => setShowAllColumns(true)} className="font-bold text-positivus-dark underline hover:text-zinc-600">
                    Show all columns
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SQL Preview */}
          {showSql && report.sqlSanitized && (
            <div className="rounded-2xl border border-positivus-dark bg-positivus-dark text-white p-4 shadow-positivus-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-positivus-green mb-2 flex items-center gap-2">
                <Database size={13} /> Sanitized Execution SQL
              </div>
              <pre className="text-xs leading-relaxed mono text-zinc-200 overflow-x-auto whitespace-pre-wrap">
                {report.sqlSanitized}
              </pre>
            </div>
          )}

          {/* Follow-up suggestions */}
          {report.followUps && report.followUps.length > 0 && (
            <div className="pt-3 border-t border-zinc-200">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Recommended Next Inquiries:</div>
              <div className="flex flex-wrap gap-2">
                {report.followUps.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSelectQuestion?.(q)}
                    className="inline-flex items-center gap-1.5 bg-positivus-grey hover:bg-positivus-green text-positivus-dark font-semibold text-xs border border-positivus-dark rounded-xl px-3 py-1.5 transition shadow-positivus-sm group"
                  >
                    <span>{q}</span>
                    <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrustRing({ score, verdict }: { score: number; verdict: GuardReport['verdict'] }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const strokeColor = verdict === 'verified' ? '#191A23' : verdict === 'warn' ? '#F59E0B' : '#E11D48';
  const bgColor = verdict === 'verified' ? '#B9FF66' : verdict === 'warn' ? '#FEF3C7' : '#FFE4E6';

  return (
    <div className="relative w-14 h-14 shrink-0 rounded-full border border-positivus-dark flex items-center justify-center shadow-positivus-sm" style={{ backgroundColor: bgColor }}>
      <svg width="50" height="50" viewBox="0 0 50 50" className="-rotate-90">
        <circle cx="25" cy="25" r={r} fill="none" stroke="#E5E7EB" strokeWidth="5" />
        <circle
          cx="25"
          cy="25"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-bold text-sm mono text-positivus-dark">{score}</span>
      </div>
    </div>
  );
}

function uiValue(v: number | string | null, unit: string): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (/₹|inr|amount|value|gross|price|revenue|sales|total/.test(unit)) return formatINR(v);
  return formatNumber(v);
}

function ClaimsTable({ report }: { report: GuardReport }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-positivus-dark flex items-center gap-2">
          <Scale size={14} /> Ground-Truth Metric Proof
          <span className="normal-case font-bold bg-positivus-green text-positivus-dark px-2 py-0.5 rounded text-[11px]">
            {report.verified.filter((v) => v.status === 'verified').length}/{report.verified.length} verified
          </span>
        </h4>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-positivus-dark shadow-positivus-sm bg-white">
        <table className="w-full text-sm">
          <thead className="bg-positivus-grey border-b border-positivus-dark">
            <tr className="text-left text-xs uppercase tracking-wider text-positivus-dark font-bold">
              <th className="px-4 py-3">Metric Claim</th>
              <th className="px-4 py-3 text-right">AI Asserted</th>
              <th className="px-4 py-3 text-right">Warehouse Truth</th>
              <th className="px-4 py-3 text-right">Δ Delta</th>
              <th className="px-4 py-3 text-center">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {report.verified.map((v) => {
              const bad = v.status === 'mismatch';
              const unk = v.status === 'unverifiable';
              const sen = v.status === 'sensitive';
              return (
                <tr key={v.claimId} className="hover:bg-positivus-grey/50">
                  <td className="px-4 py-3 font-semibold text-positivus-dark">{v.metric}</td>
                  <td className={`px-4 py-3 text-right mono font-bold ${bad ? 'text-rose-600' : 'text-zinc-800'}`}>
                    {uiValue(v.assertedValue, v.assertedUnit)}
                  </td>
                  <td className="px-4 py-3 text-right mono font-bold text-positivus-dark">
                    {uiValue(v.groundTruth, v.assertedUnit)}
                  </td>
                  <td className={`px-4 py-3 text-right mono font-bold ${bad ? 'text-rose-600' : unk ? 'text-zinc-500' : 'text-emerald-700'}`}>
                    {unk ? 'n/a' : v.deltaPct == null ? '0.0%' : `${v.deltaPct.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {bad ? (
                      <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 border border-rose-400 rounded-lg px-2 py-0.5 text-xs font-bold">
                        <XCircle size={12} /> MISMATCH
                      </span>
                    ) : unk ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-400 rounded-lg px-2 py-0.5 text-xs font-bold">
                        <AlertTriangle size={12} /> UNVERIFIABLE
                      </span>
                    ) : sen ? (
                      <span className="inline-flex items-center gap-1 bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-400 rounded-lg px-2 py-0.5 text-xs font-bold">
                        <EyeOff size={12} /> SENSITIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-positivus-green text-positivus-dark border border-positivus-dark rounded-lg px-2 py-0.5 text-xs font-bold">
                        <CheckCircle2 size={12} /> VERIFIED
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChecksSection({ checks }: { checks: Check[] }) {
  const groups: Record<string, Check[]> = { guard: [], governance: [], verification: [], statistics: [] };
  for (const c of checks) groups[c.engine].push(c);
  const engines = (Object.keys(groups) as Array<keyof typeof ENGINE_META>).filter((k) => groups[k].length > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {engines.map((engine) => {
        const meta = ENGINE_META[engine];
        const Icon = meta.Icon;
        const g = groups[engine];
        const failed = g.filter((c) => c.status === 'failed').length;
        const warned = g.filter((c) => c.status === 'warned').length;
        return (
          <div key={engine} className="rounded-2xl border border-positivus-dark bg-positivus-grey p-4 shadow-positivus-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-positivus-dark text-positivus-green flex items-center justify-center">
                <Icon size={14} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-positivus-dark">{meta.label}</span>
              <span className="ml-auto text-xs font-bold mono text-zinc-600">
                {g.length} check{g.length !== 1 ? 's' : ''}
                {failed > 0 && <span className="text-rose-600"> ({failed} fail)</span>}
                {warned > 0 && <span className="text-amber-600"> ({warned} warn)</span>}
              </span>
            </div>
            <ul className="space-y-2">
              {g.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-xs leading-snug">
                  {c.status === 'passed' ? (
                    <CheckCircle2 size={14} className="mt-0.5 text-positivus-dark shrink-0" />
                  ) : c.status === 'failed' ? (
                    <XCircle size={14} className="mt-0.5 text-rose-600 shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="mt-0.5 text-amber-600 shrink-0" />
                  )}
                  <span className="text-zinc-700 font-medium">
                    <span className="text-positivus-dark font-bold">{c.title}: </span>
                    {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}