import crypto from 'node:crypto';

/**
 * Fingerprints the entire analytical artifact so any downstream consumer can
 * cryptographically confirm the answer they received is byte-for-byte the one
 * the pipeline verified (tamper-evidence for the audit trail).
 */
export function fingerprint(parts: unknown[]): string {
  const canonical = parts
    .map((p) => JSON.stringify(p ?? null))
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex').toUpperCase();
}

export function shortFingerprint(fp: string): string {
  return `${fp.slice(0, 8)}…${fp.slice(-6)}`;
}