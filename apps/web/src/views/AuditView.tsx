import { useState } from 'react';
import type { AuditRun } from '@vertexguard/shared';
import { ShieldCheck, ShieldAlert, ShieldX, ScrollText, Fingerprint, Timer, ChevronRight, X, Database, CheckCircle2, XCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useStore } from '../store';
import { formatDuration, formatTime, shortFingerprint } from '../lib/format';

const VERDICT_BADGE = {
  verified: 'bg-positivus-green text-positivus-dark border-positivus-dark shadow-positivus-sm',
  warn: 'bg-amber-300 text-positivus-dark border-positivus-dark shadow-positivus-sm',
  rejected: 'bg-rose-500 text-white border-positivus-dark shadow-positivus-sm',
} as const;

export function AuditView() {
  const audit = useStore((s) => s.audit);
  const refreshAudit = useStore((s) => s.refreshAudit);
  const [selected, setSelected] = useState<AuditRun | null>(null);

  if (!audit) return <div className="p-16 text-center text-zinc-500 font-bold">Loading audit trail…</div>;

  const t = audit.today;
  const cards = [
    { label: 'Verified Queries', count: t.verified, Icon: ShieldCheck, theme: 'green' },
    { label: 'Warned Queries', count: t.warned, Icon: ShieldAlert, theme: 'grey' },
    { label: 'Rejected Gate', count: t.rejected, Icon: ShieldX, theme: 'dark' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="positivus-heading-pill">
            Audit Ledger
          </span>
          <p className="text-zinc-600 font-medium text-base mt-2 max-w-2xl">
            Every analytical request is fingerprinted with its SQL, execution time, and claim outcomes into an immutable audit trail.
          </p>
        </div>
        <button
          onClick={() => void refreshAudit()}
          className="btn-positivus-outline text-xs font-bold px-4 py-2.5"
        >
          Refresh Ledger
        </button>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((c) => {
          const Icon = c.Icon;
          let cardCls = 'card-positivus-grey';
          let numCls = 'text-positivus-dark';
          if (c.theme === 'green') {
            cardCls = 'card-positivus-green';
            numCls = 'text-positivus-dark';
          } else if (c.theme === 'dark') {
            cardCls = 'card-positivus-dark';
            numCls = 'text-positivus-green';
          }

          return (
            <div key={c.label} className={`${cardCls} flex flex-col justify-between`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <Icon size={16} />
                  <span>{c.label}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-current opacity-70">TODAY</span>
              </div>
              <div className={`text-4xl md:text-5xl font-bold mt-4 ${numCls}`}>
                {c.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Runs List */}
      <div className="card-positivus-white p-0 overflow-hidden">
        <div className="p-5 md:p-6 bg-positivus-grey border-b border-positivus-dark flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-base text-positivus-dark uppercase tracking-wider">
            <ScrollText size={18} />
            <span>Persisted Run Ledger</span>
          </div>
          <span className="text-xs font-mono font-bold bg-white border border-positivus-dark px-2.5 py-1 rounded-lg">
            {audit.total} total runs
          </span>
        </div>

        <div className="divide-y divide-zinc-200 max-h-[60vh] overflow-y-auto">
          {audit.runs.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full p-4 md:p-5 flex items-center gap-4 text-left hover:bg-positivus-grey/70 transition group"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-positivus-dark truncate group-hover:text-zinc-600">
                  {r.question}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 mt-1.5 font-medium">
                  <span className="mono font-bold text-positivus-dark">#{r.runId}</span>
                  <span>Role: <strong>{r.role}</strong></span>
                  <span className="flex items-center gap-1"><Fingerprint size={12} /> {shortFingerprint(r.fingerprint)}</span>
                  <span className="flex items-center gap-1"><Timer size={12} /> {formatDuration(r.durationMs)}</span>
                  <span>{formatTime(r.executedAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {r.mismatchedClaims > 0 && (
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 border border-rose-300 rounded-lg px-2 py-0.5">
                    {r.mismatchedClaims} mismatch
                  </span>
                )}
                {r.failedChecks > 0 && (
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-2 py-0.5">
                    {r.failedChecks} flags
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${VERDICT_BADGE[r.verdict]}`}>
                  {r.verdict.toUpperCase()} · {r.trustScore}
                </span>
                <div className="w-8 h-8 rounded-full bg-positivus-grey border border-positivus-dark flex items-center justify-center group-hover:bg-positivus-green transition">
                  <ChevronRight size={16} className="text-positivus-dark" />
                </div>
              </div>
            </button>
          ))}

          {audit.runs.length === 0 && (
            <div className="p-12 text-center text-zinc-500 font-bold text-sm">
              No audit runs recorded yet. Execute queries in the Ask view to generate proof logs.
            </div>
          )}
        </div>
      </div>

      {selected && <AuditDrawer run={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AuditDrawer({ run, onClose }: { run: AuditRun; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-positivus-dark/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl h-full bg-white border-l-2 border-positivus-dark shadow-positivus-lg flex flex-col overflow-hidden animate-slide-up"
      >
        <div className="flex items-center justify-between p-5 md:p-6 border-b-2 border-positivus-dark bg-positivus-grey">
          <div className="flex items-center gap-2 font-bold text-lg text-positivus-dark">
            <Database size={18} />
            <span>Audit Run Detail</span>
            <span className="font-mono text-xs text-zinc-500">#{run.runId}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl border border-positivus-dark hover:bg-white transition text-positivus-dark">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Natural Language Inquiry</div>
            <div className="text-base font-bold text-positivus-dark mt-1">{run.question}</div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${VERDICT_BADGE[run.verdict]}`}>
              {run.verdict.toUpperCase()} · {run.trustScore}/100
            </span>
            <span className="text-xs font-bold text-zinc-600 bg-positivus-grey border border-positivus-dark rounded-xl px-3 py-1.5">
              Role: {run.role} · Engine: {run.engine}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { l: 'Total Checks', v: run.checkCount, Icon: ShieldCheck, cls: 'text-positivus-dark' },
              { l: 'Failed Checks', v: run.failedChecks, Icon: XCircle, cls: run.failedChecks > 0 ? 'text-rose-600' : 'text-positivus-dark' },
              { l: 'Verified Claims', v: run.verifiedClaims, Icon: CheckCircle2, cls: 'text-emerald-700' },
              { l: 'Mismatched', v: run.mismatchedClaims, Icon: AlertTriangle, cls: run.mismatchedClaims > 0 ? 'text-amber-700' : 'text-positivus-dark' },
            ].map((s) => {
              const Icon = s.Icon;
              return (
                <div key={s.l} className="rounded-2xl border-2 border-positivus-dark bg-positivus-grey p-4 shadow-positivus-sm">
                  <div className={`text-2xl font-bold ${s.cls}`}>{s.v}</div>
                  <div className="flex items-center gap-1 text-xs font-bold text-zinc-600 mt-1">
                    <Icon size={13} className={s.cls} />
                    <span>{s.l}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Executed SQL Query</div>
            <pre className="rounded-2xl bg-positivus-dark text-white border-2 border-positivus-dark p-4 text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-positivus-sm">
              {run.sql}
            </pre>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Cryptographic Fingerprint Anchor</div>
            <div className="font-mono text-xs font-bold text-positivus-dark bg-positivus-grey border border-positivus-dark rounded-xl p-3 break-all">
              {run.fingerprint}
            </div>
            <div className="text-xs font-medium text-zinc-500 mt-1.5">
              Deterministic SHA-256 digest calculated over question, sanitized SQL, role, and verification delta.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}