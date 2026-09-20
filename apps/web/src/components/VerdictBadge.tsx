import type { Verdict } from '@vertexguard/shared';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

const STYLE: Record<Verdict, { color: string; badge: string; label: string; Icon: typeof ShieldCheck }> = {
  verified: {
    label: 'VERIFIED',
    badge: 'bg-positivus-green text-positivus-dark border-positivus-dark shadow-positivus-sm',
    color: 'text-positivus-dark',
    Icon: ShieldCheck,
  },
  warn: {
    label: 'WARNING',
    badge: 'bg-amber-300 text-positivus-dark border-positivus-dark shadow-positivus-sm',
    color: 'text-positivus-dark',
    Icon: ShieldAlert,
  },
  rejected: {
    label: 'REJECTED',
    badge: 'bg-rose-400 text-white border-positivus-dark shadow-positivus-sm',
    color: 'text-white',
    Icon: ShieldX,
  },
};

export function VerdictBadge({ verdict, score }: { verdict: Verdict; score: number }) {
  const s = STYLE[verdict];
  const Icon = s.Icon;
  return (
    <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-bold tracking-wide ${s.badge}`}>
      <Icon size={14} />
      {s.label}
      <span className={`ml-1 mono font-bold ${s.color}`}>· {score}/100</span>
    </span>
  );
}

export function trustRing(score: number) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  return { r, c, off };
}
