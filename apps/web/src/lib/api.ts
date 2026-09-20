import type { AuditFeed, CatalogResponse, GuardReport, GovernancePolicy, PolicyRule } from '@vertexguard/shared';

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  analyze(question: string, role: string, runId: string, signal?: AbortSignal): Promise<GuardReport> {
    return req('/analyze', {
      method: 'POST',
      signal,
      body: JSON.stringify({ question, role, runId }),
    });
  },
  catalog(role = 'analyst'): Promise<CatalogResponse> {
    return req(`/catalog?role=${encodeURIComponent(role)}`);
  },
  policies(): Promise<GovernancePolicy> {
    return req('/policies');
  },
  savePolicies(policy: GovernancePolicy): Promise<GovernancePolicy> {
    return req('/policies', { method: 'PUT', body: JSON.stringify({ rules: policy.rules }) });
  },
  audit(): Promise<AuditFeed> {
    return req('/audit');
  },
};

export type { GuardReport, GovernancePolicy, PolicyRule };