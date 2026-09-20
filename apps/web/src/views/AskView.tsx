import { useState } from 'react';
import {
  Send, Sparkles, RotateCcw, Quote, BarChart3, ShieldCheck,
  TrendingUp, Database, ArrowUpRight, Lock, Scale, CheckCircle2,
  Cpu, FileCode2, Layers
} from 'lucide-react';
import { useStore } from '../store';
import { VerdictBadge } from '../components/VerdictBadge';
import { StageTracker } from '../components/StageTracker';
import { ResultCard } from '../components/ResultCard';
import { AnimatedLogo } from '../components/AnimatedLogo';

const SUGGESTIONS = [
  'What is the total revenue for the last 90 days?',
  'Top 5 product categories by total sales',
  'Average order value in Mumbai vs Bengaluru',
  'Customer count and spending broken down by loyalty tier',
  'Which brand generated the highest revenue this year?',
  'List recent VIP customer orders with payment methods',
  'Total refunds and refund rate percentage across all orders',
  'Show average discount per payment method',
  'How many orders were placed in the last 30 days?',
  'Find most expensive products in Consumer Electronics',
];

const CAPABILITIES = [
  {
    num: '01',
    title: 'Natural Language to SQL Engine',
    subtitle: 'Dynamic Schema-Aware Compiler',
    desc: 'Translates arbitrary natural language business questions into precise, optimized relational SQL without hallucinated schema references.',
    theme: 'grey', // grey card
    icon: FileCode2,
    badge: 'SQL Generation',
  },
  {
    num: '02',
    title: 'Semantic Ground-Truth Verifier',
    subtitle: 'Independent SQL Assertion Check',
    desc: 'Extracts numeric claims from AI responses and re-runs deterministic ground-truth verification queries to mathematically prove validity.',
    theme: 'green', // green card
    icon: Scale,
    badge: 'Mathematical Proof',
  },
  {
    num: '03',
    title: 'Static SQL Security Guard',
    subtitle: 'Zero-Trust Query Inspection',
    desc: 'AST static inspection blocks destructive DDL/DML, restricts multi-statement injection, and enforces mandatory safety bounds.',
    theme: 'dark', // dark card
    icon: ShieldCheck,
    badge: 'Zero-Trust Gate',
  },
  {
    num: '04',
    title: 'Governance & PII Masking',
    subtitle: 'Role-Based Real-Time Redaction',
    desc: 'Enforces column-level data redaction on Aadhaar, Phone, Email, and blocks restricted schemas based on caller permissions.',
    theme: 'green', // green card
    icon: Lock,
    badge: 'Privacy Redaction',
  },
  {
    num: '05',
    title: 'Statistical Anomaly Audit',
    subtitle: 'Outlier & Benford Distribution',
    desc: 'Analyzes query result sets against historical baselines, Benford distribution, and extreme variance flags before user exposure.',
    theme: 'grey', // grey card
    icon: BarChart3,
    badge: 'Distribution Analysis',
  },
  {
    num: '06',
    title: 'Immutable Audit Ledger',
    subtitle: 'Cryptographic SHA-256 Anchors',
    desc: 'Every run, generated SQL, verification delta, and policy decision is fingerprinted into an immutable tamper-evident audit trail.',
    theme: 'dark', // dark card
    icon: Database,
    badge: 'Tamper Evident',
  },
];

const PARTNER_LOGOS = [
  { name: 'PostgreSQL', label: 'PostgreSQL Warehouse' },
  { name: 'Google Gemini', label: 'Google Gemini 2.5' },
  { name: 'OpenAI', label: 'GPT-4o Analytics' },
  { name: 'DuckDB', label: 'DuckDB Engine' },
  { name: 'Snowflake', label: 'Snowflake Connected' },
  { name: 'BigQuery', label: 'BigQuery Compliant' },
];

export function AskView() {
  const messages = useStore((s) => s.messages);
  const submit = useStore((s) => s.submit);
  const submitting = useStore((s) => s.submitting);
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const audit = useStore((s) => s.audit);
  const [draft, setDraft] = useState('');

  const onSubmit = async () => {
    const q = draft.trim();
    if (!q || submitting) return;
    setDraft('');
    try {
      await submit(q, role);
    } catch {
      /* error surfaced in message card */
    }
  };

  const handleSelect = (q: string) => {
    setDraft(q);
    const consoleEl = document.getElementById('query-console');
    if (consoleEl) {
      consoleEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const todayStats = audit?.today;
  const totalToday = todayStats ? todayStats.verified + todayStats.warned + todayStats.rejected : 0;
  const verifRate = totalToday > 0 ? Math.round((todayStats!.verified / totalToday) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. Positivus Hero Section                                     */}
      {/* ------------------------------------------------------------- */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 bg-positivus-green text-positivus-dark border border-positivus-dark px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-positivus-sm">
            <Sparkles size={14} /> Real-Time LLM Analytics Shield
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-positivus-dark leading-[1.15]">
            Navigating data intelligence <br className="hidden sm:inline" />
            <span className="bg-positivus-green text-positivus-dark px-3 py-1 rounded-xl border border-positivus-dark shadow-positivus-sm inline-block mt-2">
              with proof
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 font-medium max-w-xl leading-relaxed">
            Our multi-tier Guardian pipeline intercepts NL-to-SQL generation, validates static syntax, enforces PII governance, and proves every metric claim with warehouse ground-truth before you see it.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="#query-console"
              className="btn-positivus-primary text-base font-bold px-8 py-4"
            >
              Ask AI &amp; Verify
            </a>
            <button
              onClick={() => handleSelect(SUGGESTIONS[0])}
              className="btn-positivus-outline text-base font-bold px-8 py-4"
            >
              Try Sample Query
            </button>
          </div>
        </div>

        {/* Hero Graphic Card (Positivus Illustration Style) */}
        <div className="lg:col-span-5">
          <div className="card-positivus-grey relative overflow-hidden p-6 sm:p-8 flex flex-col justify-between min-h-[360px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-positivus-dark" />
                <span className="w-3.5 h-3.5 rounded-full bg-positivus-green border border-positivus-dark" />
                <span className="w-3.5 h-3.5 rounded-full bg-white border border-positivus-dark" />
              </div>
              <span className="font-mono text-xs font-bold text-positivus-dark bg-white border border-positivus-dark px-2.5 py-1 rounded-lg">
                GUARD_STATUS = 200 OK
              </span>
            </div>

            {/* Illustration Visual with Animated Logo */}
            <div className="my-6 space-y-3">
              <div className="bg-white border-2 border-positivus-dark rounded-2xl p-4 shadow-positivus-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AnimatedLogo size="lg" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Live Guard Core</div>
                    <div className="text-sm font-bold text-positivus-dark">Autonomous Verification Engine</div>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold bg-positivus-green text-positivus-dark border border-positivus-dark px-2.5 py-1 rounded-lg">
                  98/100
                </span>
              </div>

              <div className="bg-positivus-dark text-white border-2 border-positivus-dark rounded-2xl p-4 shadow-positivus-sm flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-positivus-green uppercase tracking-wider">Ground-Truth Proof</div>
                  <div className="text-sm font-bold mt-0.5">₹287.15 Cr Verified</div>
                </div>
                <div className="w-9 h-9 rounded-full bg-positivus-green text-positivus-dark flex items-center justify-center font-bold">
                  ✓
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-zinc-600 border-t border-positivus-dark/20 pt-3">
              <span>Zero-Hallucination Gate</span>
              <span>SHA-256 Fingerprinted</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 2. Partner / Technologies Marquee Banner                      */}
      {/* ------------------------------------------------------------- */}
      <section className="border-y border-zinc-200 py-6 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[700px] gap-8 grayscale hover:grayscale-0 transition-all opacity-80 hover:opacity-100">
          {PARTNER_LOGOS.map((p) => (
            <div key={p.name} className="flex items-center gap-2 font-bold text-lg text-positivus-dark tracking-tight">
              <span className="w-2.5 h-2.5 rounded-full bg-positivus-dark" />
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. Interactive Query Console Section                          */}
      {/* ------------------------------------------------------------- */}
      <section id="query-console" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="positivus-heading-pill">
              Ask the Data
            </span>
            <p className="text-zinc-600 font-medium text-base mt-2 max-w-xl">
              Type any business question. The AI Agent writes relational SQL, and the Guardian engine executes live verification.
            </p>
          </div>

          {/* Quick Metrics Pill */}
          {totalToday > 0 && (
            <div className="inline-flex items-center gap-3 bg-positivus-grey border border-positivus-dark rounded-2xl px-4 py-2.5 shadow-positivus-sm">
              <BarChart3 size={16} className="text-positivus-dark" />
              <div className="text-xs font-bold text-positivus-dark">
                <span>{totalToday} Queries</span>
                <span className="text-zinc-400 mx-1.5">|</span>
                <span className="text-emerald-700">{verifRate}% Verified</span>
              </div>
            </div>
          )}
        </div>

        {/* Positivus Styled Query Composer Card */}
        <div className="card-positivus-grey p-6 md:p-8 space-y-6">
          {/* Role selection radio pills */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-bold text-positivus-dark">Select Persona / Role:</span>
            <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition shadow-positivus-sm ${role === 'analyst' ? 'bg-positivus-green text-positivus-dark border-positivus-dark' : 'bg-white text-zinc-700 border-positivus-dark'}`}>
              <input
                type="radio"
                name="role"
                value="analyst"
                checked={role === 'analyst'}
                onChange={() => setRole('analyst')}
                className="hidden"
              />
              <span className={`w-3 h-3 rounded-full border border-positivus-dark ${role === 'analyst' ? 'bg-positivus-dark' : 'bg-white'}`} />
              Analyst (Masked PII)
            </label>

            <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition shadow-positivus-sm ${role === 'executive' ? 'bg-positivus-green text-positivus-dark border-positivus-dark' : 'bg-white text-zinc-700 border-positivus-dark'}`}>
              <input
                type="radio"
                name="role"
                value="executive"
                checked={role === 'executive'}
                onChange={() => setRole('executive')}
                className="hidden"
              />
              <span className={`w-3 h-3 rounded-full border border-positivus-dark ${role === 'executive' ? 'bg-positivus-dark' : 'bg-white'}`} />
              Executive (Full Analytics Access)
            </label>
          </div>

          {/* Textarea input */}
          <div className="bg-white border-2 border-positivus-dark rounded-[24px] p-4 shadow-positivus-sm focus-within:shadow-positivus transition">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void onSubmit();
              }}
              rows={3}
              placeholder='e.g. "What is the total revenue for 2024?", "Top 5 product categories by units sold", "Show average order value by state"...'
              className="w-full resize-none bg-transparent text-base font-medium text-positivus-dark placeholder:text-zinc-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100">
              <span className="text-xs font-bold text-zinc-500 hidden sm:inline">
                Press <strong>Ctrl/⌘ + Enter</strong> to execute
              </span>
              <button
                onClick={onSubmit}
                disabled={!draft.trim() || submitting}
                className="btn-positivus-primary text-sm font-bold px-6 py-3 ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={15} />
                <span>{submitting ? 'Executing & Verifying…' : 'Ask AI & Verify'}</span>
              </button>
            </div>
          </div>

          {/* Suggestions pills */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-600">
              <Quote size={13} /> Sample Analytical Inquiries:
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  className="bg-white hover:bg-positivus-green text-positivus-dark font-semibold text-xs border border-positivus-dark rounded-xl px-3.5 py-2 transition shadow-positivus-sm flex items-center gap-1.5 group"
                >
                  <span>{s}</span>
                  <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. Live Conversation & Audit Stream                          */}
      {/* ------------------------------------------------------------- */}
      {messages.length > 0 && (
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="positivus-heading-pill">
              Live Verified Reports
            </span>
            <span className="text-xs font-mono font-bold text-zinc-500 bg-positivus-grey border border-positivus-dark px-2.5 py-1 rounded-lg">
              {messages.length} run{messages.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-8">
            {messages.map((m) => (
              <div key={m.runId} className="space-y-4">
                {/* User Prompt Header */}
                <div className="flex items-start gap-3 bg-positivus-dark text-white border border-positivus-dark rounded-[24px] p-4 md:p-5 shadow-positivus-sm">
                  <div className="w-8 h-8 rounded-full bg-positivus-green text-positivus-dark font-bold flex items-center justify-center shrink-0 text-sm">
                    Q
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-bold text-white leading-snug">{m.question}</div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mt-1.5 font-medium">
                      <span className="mono text-positivus-green">#{m.runId}</span>
                      <span>Role: <strong>{m.role}</strong></span>
                      <button
                        onClick={() => handleSelect(m.question)}
                        className="flex items-center gap-1 text-white underline hover:text-positivus-green font-bold"
                      >
                        <RotateCcw size={12} /> Rerun
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stage Tracker / Live Progress */}
                {!m.done && <StageTracker stages={m.stages} />}

                {/* Error Banner */}
                {m.error && (
                  <div className="rounded-2xl border-2 border-rose-600 bg-rose-100 p-4 text-sm font-bold text-rose-900 shadow-positivus-sm">
                    Request Error: {m.error}
                  </div>
                )}

                {/* Result Report Card */}
                {m.done && m.report && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 pl-4 md:pl-10">
                      <VerdictBadge verdict={m.report.verdict} score={m.report.trustScore} />
                      <span className="text-xs font-bold text-zinc-600">
                        {m.report.llmEngine} · Self-confidence {(m.report.llmConfidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <ResultCard report={m.report} onSelectQuestion={handleSelect} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. Positivus 6-Card Services / Capabilities Grid               */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="positivus-heading-pill">
              Guardian Capabilities
            </span>
            <p className="text-zinc-600 font-medium text-base mt-2 max-w-2xl">
              At our core, VertexGuard delivers comprehensive semantic proof, static SQL AST enforcement, and automated governance.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            let cardCls = 'card-positivus-grey';
            let circleCls = 'icon-btn-circle-dark';
            let pillCls = 'bg-positivus-green text-positivus-dark';

            if (c.theme === 'green') {
              cardCls = 'card-positivus-green';
              circleCls = 'icon-btn-circle-dark';
              pillCls = 'bg-white text-positivus-dark';
            } else if (c.theme === 'dark') {
              cardCls = 'card-positivus-dark';
              circleCls = 'icon-btn-circle-white';
              pillCls = 'bg-positivus-green text-positivus-dark';
            }

            return (
              <div key={c.num} className={`${cardCls} flex flex-col justify-between group`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`inline-block font-bold text-xs px-3 py-1 rounded-lg border border-positivus-dark shadow-positivus-sm ${pillCls}`}>
                      {c.badge}
                    </span>
                    <span className="font-mono font-bold text-xl opacity-60">{c.num}</span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold tracking-tight leading-snug">
                      {c.title}
                    </h3>
                    <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${c.theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {c.subtitle}
                    </p>
                  </div>

                  <p className={`text-sm font-medium leading-relaxed ${c.theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {c.desc}
                  </p>
                </div>

                <div className="pt-6 flex items-center justify-between border-t border-current/10 mt-6">
                  <span className="text-xs font-bold uppercase tracking-wider">Inspect Proof</span>
                  <div className={circleCls}>
                    <ArrowUpRight size={18} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. "Let's make things happen" Positivus CTA Banner           */}
      {/* ------------------------------------------------------------- */}
      <section className="card-positivus-grey p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-4 max-w-xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-positivus-dark">
            Let&apos;s make your data answers <span className="bg-positivus-green px-2 rounded-lg border border-positivus-dark shadow-positivus-sm">tamper-proof</span>
          </h2>
          <p className="text-zinc-600 font-medium text-sm sm:text-base">
            Contact us today to integrate the VertexGuard semantic verification proxy into your AI pipelines, dashboards, or Slack bots.
          </p>
          <div className="pt-2">
            <a
              href="#query-console"
              className="btn-positivus-primary font-bold px-8 py-4 text-base"
            >
              Start Live Querying
            </a>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center relative">
          <AnimatedLogo size="2xl" variant="hero" />
        </div>
      </section>
    </div>
  );
}
