import { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare, Database, ScrollText, Sparkles, X } from 'lucide-react';
import { useStore } from '../store';
import type { View } from '../store';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: typeof MessageSquare;
  action: () => void;
}

const PRESET_QUESTIONS = [
  'What is the total revenue for the last 90 days?',
  'Top 5 product categories by total sales',
  'Average order value in Mumbai vs Bengaluru',
  'Customer count and spending by loyalty tier',
  'Total refunds and refund rate percentage',
  'Which brand generated the highest revenue this year?',
];

export function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (v: View) => void }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setRole, role } = useStore.getState();

  const items: CommandItem[] = [
    { id: 'nav:ask', label: 'Go to Ask the Data (AI Console)', icon: MessageSquare, action: () => { onNavigate('ask'); onClose(); } },
    { id: 'nav:governance', label: 'Go to Governance & Compliance', icon: Database, action: () => { onNavigate('governance'); onClose(); } },
    { id: 'nav:audit', label: 'Go to Immutable Audit Ledger', icon: ScrollText, action: () => { onNavigate('audit'); onClose(); } },
    { id: 'role:analyst', label: 'Switch role to Analyst', hint: role === 'analyst' ? '(current)' : undefined, icon: Sparkles, action: () => { setRole('analyst'); onClose(); } },
    { id: 'role:executive', label: 'Switch role to Executive', hint: role === 'executive' ? '(current)' : undefined, icon: Sparkles, action: () => { setRole('executive'); onClose(); } },
    ...PRESET_QUESTIONS.map((q, i) => ({
      id: `preset:${i}`,
      label: q,
      hint: 'preset query',
      icon: MessageSquare,
      action: () => { onNavigate('ask'); onClose(); },
    })),
  ];

  const filtered = query.trim()
    ? items.filter((it) => it.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && filtered[selectedIdx]) { filtered[selectedIdx].action(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, selectedIdx]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-positivus-dark/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl rounded-[28px] border-2 border-positivus-dark bg-white shadow-positivus-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-positivus-dark bg-positivus-grey">
          <Search size={18} className="text-positivus-dark shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search analytical presets…"
            className="flex-1 bg-transparent text-sm font-semibold text-positivus-dark placeholder:text-zinc-500 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-200 text-positivus-dark">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-8 font-medium">No matching commands found</div>
          )}
          {filtered.map((item, i) => {
            const Icon = item.icon;
            const isSelected = i === selectedIdx;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-positivus-green text-positivus-dark border border-positivus-dark shadow-positivus-sm'
                    : 'text-zinc-800 hover:bg-positivus-grey border border-transparent'
                }`}
              >
                <Icon size={16} className={isSelected ? 'text-positivus-dark' : 'text-zinc-500'} />
                <span className="flex-1 text-left font-semibold truncate">{item.label}</span>
                {item.hint && <span className="text-xs font-mono text-zinc-500 font-bold">{item.hint}</span>}
              </button>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-zinc-200 bg-positivus-grey flex items-center justify-between text-xs font-semibold text-zinc-600">
          <span><kbd className="mono bg-white border border-positivus-dark rounded px-1.5 py-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="mono bg-white border border-positivus-dark rounded px-1.5 py-0.5">↵</kbd> select</span>
          <span><kbd className="mono bg-white border border-positivus-dark rounded px-1.5 py-0.5">esc</kbd> dismiss</span>
        </div>
      </div>
    </div>
  );
}
