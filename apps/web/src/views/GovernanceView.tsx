import { useState } from 'react';
import { Save, Plus, Trash2, Search, EyeOff, Lock, ShieldAlert, Info, Layers, Columns3, CheckCircle2 } from 'lucide-react';
import type { PolicyRule, Sensitivity } from '@vertexguard/shared';
import { useStore } from '../store';

const SENS_BADGE: Record<Sensitivity, { label: string; cls: string }> = {
  public: { label: 'PUBLIC', cls: 'bg-zinc-100 text-zinc-700 border-zinc-300' },
  internal: { label: 'INTERNAL', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  confidential: { label: 'CONFIDENTIAL', cls: 'bg-amber-100 text-amber-900 border-amber-400' },
  pii: { label: 'PII', cls: 'bg-rose-100 text-rose-800 border-rose-400' },
  spi: { label: 'SPI', cls: 'bg-purple-100 text-purple-800 border-purple-400' },
  restricted: { label: 'RESTRICTED', cls: 'bg-positivus-dark text-white border-positivus-dark' },
};

const ACTION_META = {
  allow: { label: 'ALLOW', cls: 'bg-positivus-green text-positivus-dark border-positivus-dark' },
  deny: { label: 'DENY', cls: 'bg-rose-500 text-white border-positivus-dark' },
  mask: { label: 'MASK', cls: 'bg-amber-300 text-positivus-dark border-positivus-dark' },
} as const;

export function GovernanceView() {
  const policy = useStore((s) => s.policy);
  const savePolicy = useStore((s) => s.savePolicy);
  const rank = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const refreshCatalog = useStore((s) => s.refreshCatalog);

  const [draft, setDraft] = useState<Partial<PolicyRule>>({
    role: '*', action: 'mask', scope: 'column', target: 'customers.phone',
    reason: 'Personal contact - mask before output.', enabled: true,
  });
  const [saved, setSaved] = useState(false);

  if (!policy) return <div className="p-16 text-center text-zinc-500 font-bold">Loading governance policy…</div>;

  const toggle = (id: string) => {
    void savePolicy({ ...policy, rules: policy.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) }).then(() => flashSaved());
  };
  const remove = (id: string) => {
    void savePolicy({ ...policy, rules: policy.rules.filter((r) => r.id !== id) }).then(() => flashSaved());
  };
  const add = () => {
    if (!draft.target || !draft.action) return;
    const rule: PolicyRule = {
      id: `pol-${Date.now().toString(36)}`,
      role: draft.role ?? '*',
      action: draft.action as PolicyRule['action'],
      scope: draft.scope as PolicyRule['scope'],
      target: draft.target,
      reason: draft.reason ?? '',
      enabled: true,
    };
    void savePolicy({ ...policy, rules: [...policy.rules, rule] }).then(() => flashSaved());
  };
  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="positivus-heading-pill">
            Governance &amp; Policy
          </span>
          <p className="text-zinc-600 font-medium text-base mt-2 max-w-xl">
            Fine-grained role-based policies enforced on every SQL query — deny tables, mask PII, and maintain zero-trust compliance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-positivus-dark">
            <span>Preview Role:</span>
            <select
              value={rank}
              onChange={(e) => { setRole(e.target.value); void refreshCatalog(e.target.value); }}
              className="bg-white border-2 border-positivus-dark rounded-xl px-3 py-2 text-sm font-bold text-positivus-dark shadow-positivus-sm focus:outline-none"
            >
              <option value="analyst">Analyst</option>
              <option value="executive">Executive</option>
            </select>
          </label>
          <span className="text-xs font-mono font-bold bg-positivus-grey border border-positivus-dark rounded-xl px-3 py-2 text-positivus-dark">
            Policy v{policy.version}
          </span>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-positivus-green text-positivus-dark border border-positivus-dark px-2.5 py-1.5 rounded-xl shadow-positivus-sm">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: Policy Rules + Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Active Rules */}
        <div className="lg:col-span-6 space-y-6">
          <div className="card-positivus-white p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-positivus-dark">
                <Lock size={16} /> Active Access Rules
              </div>
              <span className="text-xs font-mono font-bold bg-positivus-grey border border-positivus-dark px-2.5 py-1 rounded-lg">
                {policy.rules.length} rules
              </span>
            </div>

            <div className="space-y-3">
              {policy.rules.map((r) => {
                const a = ACTION_META[r.action];
                return (
                  <div
                    key={r.id}
                    className={`rounded-2xl border-2 border-positivus-dark p-4 flex items-center gap-3 transition-all ${
                      r.enabled
                        ? 'bg-positivus-grey shadow-positivus-sm'
                        : 'bg-zinc-100 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${a.cls}`}>
                          {a.label}
                        </span>
                        <span className="font-mono text-sm font-bold text-positivus-dark truncate">
                          {r.target}
                        </span>
                        {r.role !== '*' && (
                          <span className="text-[11px] font-bold bg-white border border-positivus-dark rounded px-1.5 py-0.5 text-zinc-600">
                            role: {r.role}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-zinc-600 truncate">{r.reason}</div>
                    </div>

                    <button
                      onClick={() => toggle(r.id)}
                      className={`relative w-11 h-6 rounded-full border border-positivus-dark transition-all ${
                        r.enabled ? 'bg-positivus-dark' : 'bg-zinc-300'
                      }`}
                      title={r.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full border border-positivus-dark transition-all ${
                          r.enabled ? 'left-[22px] bg-positivus-green' : 'left-0.5 bg-white'
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => remove(r.id)}
                      className="p-1.5 rounded-lg border border-transparent hover:border-rose-400 hover:bg-rose-50 text-zinc-500 hover:text-rose-600 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Rule Form */}
            <div className="mt-6 rounded-2xl border-2 border-dashed border-positivus-dark bg-positivus-grey/60 p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-positivus-dark flex items-center gap-1.5">
                <Plus size={14} /> Add New Governance Rule
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={draft.role ?? ''}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  placeholder="Role (or * for all)"
                  className="bg-white border border-positivus-dark rounded-xl px-3 py-2 text-xs font-bold text-positivus-dark focus:outline-none"
                />
                <input
                  value={draft.target ?? ''}
                  onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                  placeholder="table or table.column"
                  className="bg-white border border-positivus-dark rounded-xl px-3 py-2 text-xs font-mono font-bold text-positivus-dark focus:outline-none"
                />
                <select
                  value={draft.action}
                  onChange={(e) => setDraft({ ...draft, action: e.target.value as PolicyRule['action'] })}
                  className="bg-white border border-positivus-dark rounded-xl px-3 py-2 text-xs font-bold text-positivus-dark focus:outline-none"
                >
                  <option value="allow">Action: Allow</option>
                  <option value="deny">Action: Deny</option>
                  <option value="mask">Action: Mask</option>
                </select>
                <select
                  value={draft.scope}
                  onChange={(e) => setDraft({ ...draft, scope: e.target.value as PolicyRule['scope'] })}
                  className="bg-white border border-positivus-dark rounded-xl px-3 py-2 text-xs font-bold text-positivus-dark focus:outline-none"
                >
                  <option value="table">Scope: Table</option>
                  <option value="column">Scope: Column</option>
                </select>
              </div>
              <input
                value={draft.reason ?? ''}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                placeholder="Compliance reason / audit justification"
                className="w-full bg-white border border-positivus-dark rounded-xl px-3 py-2 text-xs font-medium text-positivus-dark focus:outline-none"
              />
              <button
                onClick={add}
                className="w-full btn-positivus-primary text-xs font-bold py-3"
              >
                <Save size={14} /> Add &amp; Save Rule
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Catalog Explorer */}
        <div className="lg:col-span-6">
          <CatalogExplorer />
        </div>
      </div>
    </div>
  );
}

function CatalogExplorer() {
  const catalog = useStore((s) => s.catalog);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(catalog?.tables[0]?.name ?? null);

  if (!catalog) return <div className="card-positivus-grey p-8 text-center text-sm font-bold text-zinc-500">Loading catalog…</div>;

  const filtered = catalog.tables.filter(
    (t) =>
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      t.columns.some((c) => c.name.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="card-positivus-white p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-positivus-dark">
          <Layers size={16} /> Warehouse Catalog
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search schemas…"
            className="bg-positivus-grey border border-positivus-dark rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-positivus-dark focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((t) => {
          const piiCols = t.columns.filter((c) => c.sensitivity === 'pii' || c.sensitivity === 'spi' || c.sensitivity === 'restricted').length;
          const isOpen = open === t.name;
          const sBadge = SENS_BADGE[t.sensitivity];
          return (
            <div key={t.name} className="rounded-2xl border-2 border-positivus-dark bg-positivus-grey overflow-hidden shadow-positivus-sm">
              <button
                onClick={() => setOpen(isOpen ? null : t.name)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-zinc-200 transition"
              >
                <span className="font-mono text-sm font-bold text-positivus-dark">{t.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sBadge.cls}`}>
                  {sBadge.label}
                </span>
                {piiCols > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 rounded px-1.5 py-0.5">
                    <EyeOff size={11} /> {piiCols} PII
                  </span>
                )}
                <span className="ml-auto text-xs font-mono font-bold text-zinc-600">
                  {t.columns.length} columns
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-positivus-dark bg-white p-4 space-y-3">
                  <p className="text-xs text-zinc-600 font-medium">{t.description}</p>
                  <ul className="divide-y divide-zinc-100">
                    {columnSorted(t).map((c) => {
                      const colSens = SENS_BADGE[c.sensitivity];
                      return (
                        <li key={c.name} className="py-2 flex items-center gap-2 text-xs">
                          <Columns3 size={13} className="text-zinc-500" />
                          <span className="font-mono font-bold text-positivus-dark">{c.name}</span>
                          <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{c.type}</span>
                          {c.piiKind && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Info size={10} /> {c.piiKind}
                            </span>
                          )}
                          <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded border ${colSens.cls}`}>
                            {colSens.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="text-[11px] font-medium text-zinc-500 pt-2 border-t border-zinc-100 flex items-center gap-1">
                    <ShieldAlert size={12} />
                    <span>Live Postgres dialect reflection</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function columnSorted(t: { columns: Array<import('@vertexguard/shared').ColumnMeta> }) {
  const rankMap = { public: 0, internal: 1, confidential: 2, pii: 3, spi: 4, restricted: 5 };
  return [...t.columns].sort((a, b) => rankMap[b.sensitivity] - rankMap[a.sensitivity]);
}