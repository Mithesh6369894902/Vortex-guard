import { useEffect, useState } from 'react';
import { ShieldCheck, Database, ScrollText, MessagesSquare, Command, Sparkles, ArrowUpRight, Github, Twitter, Linkedin } from 'lucide-react';
import { useStore } from './store';
import { ws } from './lib/ws';
import { AskView } from './views/AskView';
import { GovernanceView } from './views/GovernanceView';
import { AuditView } from './views/AuditView';
import { CommandPalette } from './components/CommandPalette';
import { AnimatedLogo } from './components/AnimatedLogo';

export function App() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const refreshAudit = useStore((s) => s.refreshAudit);
  const refreshPolicy = useStore((s) => s.refreshPolicy);
  const refreshCatalog = useStore((s) => s.refreshCatalog);
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const setStage = useStore((s) => s.setStage);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    ws.connect();
    const off = ws.on((evt) => {
      if (evt.kind === 'stage') setStage(evt.runId, evt.stage, evt.status, evt.durationMs, evt.detail);
    });
    void refreshAudit();
    void refreshPolicy();
    void refreshCatalog(role);
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen((o) => !o); }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const nav = [
    { id: 'ask' as const, label: 'Ask the Data', icon: MessagesSquare },
    { id: 'governance' as const, label: 'Governance & Rules', icon: Database },
    { id: 'audit' as const, label: 'Audit Ledger', icon: ScrollText },
  ];

  return (
    <div className="min-h-screen bg-white text-positivus-dark flex flex-col selection:bg-positivus-green selection:text-positivus-dark font-sans">
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} onNavigate={setView} />}

      {/* ------------------------------------------------------------- */}
      {/* Positivus Header / Navigation Bar                             */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => setView('ask')}
            className="group text-left focus:outline-none"
          >
            <AnimatedLogo size="md" withText />
          </button>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                    active
                      ? 'bg-positivus-green text-positivus-dark border border-positivus-dark shadow-positivus-sm'
                      : 'text-zinc-700 hover:text-positivus-dark hover:bg-positivus-grey'
                  }`}
                >
                  <Icon size={16} />
                  <span>{n.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right actions: Role pill, Search/Command palette, CTA button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden lg:flex items-center gap-2 bg-positivus-grey hover:bg-zinc-200 text-zinc-700 hover:text-positivus-dark border border-positivus-dark rounded-2xl px-3.5 py-2 text-xs font-bold transition shadow-positivus-sm"
              title="Command Palette"
            >
              <Command size={13} />
              <span>Search</span>
              <kbd className="mono text-[10px] bg-white border border-zinc-400 rounded px-1.5 py-0.5">⌘K</kbd>
            </button>

            <label className="hidden sm:flex items-center gap-1.5 bg-positivus-grey border border-positivus-dark rounded-2xl px-3 py-1.5 text-xs font-bold text-positivus-dark shadow-positivus-sm">
              <span className="text-zinc-500">Role:</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-transparent font-bold text-positivus-dark focus:outline-none cursor-pointer"
              >
                <option value="analyst">Analyst</option>
                <option value="executive">Executive</option>
              </select>
            </label>

            <button
              onClick={() => {
                if (view !== 'ask') setView('ask');
                const el = document.getElementById('query-console');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-positivus-outline text-xs sm:text-sm font-bold px-4 sm:px-5 py-2.5"
            >
              <span>Launch Query</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="md:hidden flex items-center justify-around border-t border-zinc-200 bg-positivus-grey px-2 py-2">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  active ? 'bg-positivus-green text-positivus-dark border border-positivus-dark' : 'text-zinc-600'
                }`}
              >
                <Icon size={14} />
                <span>{n.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* Main View Area                                                */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 min-w-0">
        {view === 'ask' && <AskView />}
        {view === 'governance' && <GovernanceView />}
        {view === 'audit' && <AuditView />}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* Positivus Signature Dark Footer                               */}
      {/* ------------------------------------------------------------- */}
      <footer className="mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-positivus-dark text-white rounded-t-[36px] md:rounded-t-[45px] p-8 sm:p-12 md:p-16 space-y-12">
            {/* Top row: Brand + Nav links + Socials */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-zinc-700">
              <button
                onClick={() => {
                  setView('ask');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group text-left focus:outline-none"
              >
                <AnimatedLogo size="md" variant="inverted" withText />
              </button>

              <div className="flex flex-wrap items-center gap-6 text-sm font-medium">
                {nav.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setView(n.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`hover:text-positivus-green transition ${view === n.id ? 'text-positivus-green underline font-bold' : 'text-zinc-300'}`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <a href="#github" className="w-8 h-8 rounded-full bg-white text-positivus-dark flex items-center justify-center hover:bg-positivus-green transition">
                  <Github size={15} />
                </a>
                <a href="#twitter" className="w-8 h-8 rounded-full bg-white text-positivus-dark flex items-center justify-center hover:bg-positivus-green transition">
                  <Twitter size={15} />
                </a>
                <a href="#linkedin" className="w-8 h-8 rounded-full bg-white text-positivus-dark flex items-center justify-center hover:bg-positivus-green transition">
                  <Linkedin size={15} />
                </a>
              </div>
            </div>

            {/* Middle row: Contact info + Newsletter subscription pill */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-3">
                <span className="inline-block bg-positivus-green text-positivus-dark font-bold text-xs px-2.5 py-1 rounded-md uppercase tracking-wider">
                  Contact Us
                </span>
                <div className="text-sm text-zinc-300 space-y-1 font-medium">
                  <p>Email: compliance@vertexguard.ai</p>
                  <p>Phone: +1 (555) 987-6543</p>
                  <p>Address: 100 Innovation Way, Suite 400, AI Data Center</p>
                </div>
              </div>

              <div className="lg:col-span-7 bg-positivus-slate rounded-[24px] p-6 flex flex-col sm:flex-row items-center gap-4">
                <input
                  type="email"
                  placeholder="Enter your security email"
                  className="w-full sm:flex-1 bg-transparent border border-zinc-600 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:border-positivus-green"
                />
                <button
                  onClick={() => alert('Subscribed to VertexGuard security advisories!')}
                  className="w-full sm:w-auto bg-positivus-green text-positivus-dark font-bold text-sm px-6 py-3.5 rounded-2xl border border-positivus-green hover:bg-white transition whitespace-nowrap"
                >
                  Subscribe to Alerts
                </button>
              </div>
            </div>

            {/* Bottom copyright row */}
            <div className="pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 font-medium">
              <div>
                © {new Date().getFullYear()} VertexGuard Inc. All rights reserved. Positivus Design System.
              </div>
              <div className="flex items-center gap-4">
                <a href="#privacy" className="underline hover:text-white">Privacy Policy</a>
                <a href="#terms" className="underline hover:text-white">Terms of Service</a>
                <span className="flex items-center gap-1 text-positivus-green font-bold">
                  <span className="w-2 h-2 rounded-full bg-positivus-green inline-block animate-pulse" />
                  Postgres Warehouse Online
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
