import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root: apps/api/src/paths.ts -> ../../../ = repository root. */
export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function dataDir(...parts: string[]): string {
  return path.join(repoRoot(), 'data', ...parts);
}