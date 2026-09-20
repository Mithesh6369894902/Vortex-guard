/** Format an amount in Indian locale with ₹ symbol and Cr/L notation. */
export function formatINR(n: number | null | undefined, compact = true): string {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (compact && abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (compact && abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (compact && abs >= 1e3) return `₹${(n / 1e3).toFixed(2)} K`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

export function shortFingerprint(fp: string): string {
  return `${fp.slice(0, 10)}…${fp.slice(-8)}`;
}

export function uid(): string {
  return 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}