import { create } from 'zustand';
import type { AuditFeed, CatalogResponse, GovernancePolicy, GuardReport, PipelineStage, StageStatus } from '@vertexguard/shared';

export interface StageState {
  status: StageStatus | 'idle' | 'running';
  durationMs?: number;
  detail?: string;
  at: number;
}

export type View = 'ask' | 'governance' | 'audit';

export interface Message {
  runId: string;
  question: string;
  role: string;
  stages: Partial<Record<PipelineStage, StageState>>;
  report?: GuardReport;
  error?: string;
  done: boolean;
}

const idleStages = (): Message['stages'] => ({
  planning: { status: 'idle', at: 0 },
  guard: { status: 'idle', at: 0 },
  governance: { status: 'idle', at: 0 },
  execution: { status: 'idle', at: 0 },
  verification: { status: 'idle', at: 0 },
  statistics: { status: 'idle', at: 0 },
  report: { status: 'idle', at: 0 },
  persisted: { status: 'idle', at: 0 },
});

interface Store {
  view: View;
  setView: (v: View) => void;
  role: string;
  setRole: (r: string) => void;
  messages: Message[];
  activeRunId: string | null;
  submitting: boolean;
  submit: (question: string, role: string) => Promise<GuardReport>;
  setStage: (runId: string, stage: PipelineStage, status: StageStatus | 'running', durationMs?: number, detail?: string) => void;
  failedRun: (runId: string, error: string) => void;
  catalog: CatalogResponse | null;
  policy: GovernancePolicy | null;
  audit: AuditFeed | null;
  refreshCatalog: (role: string) => Promise<void>;
  refreshPolicy: () => Promise<void>;
  savePolicy: (p: GovernancePolicy) => Promise<void>;
  refreshAudit: () => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  view: 'ask',
  setView: (view) => set({ view }),
  role: 'analyst',
  setRole: (role) => set({ role }),

  messages: [],
  activeRunId: null,
  submitting: false,

  submit: async (question, role) => {
    const runId = 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    const msg: Message = { runId, question, role, stages: idleStages(), done: false };
    set((s) => ({ messages: [msg, ...s.messages].slice(0, 40), activeRunId: runId, submitting: true }));
    try {
      const { api } = await import('./lib/api');
      const report = await api.analyze(question, role, runId);
      set((s) => ({
        messages: s.messages.map((m) => (m.runId === runId ? { ...m, report, done: true } : m)),
        activeRunId: null,
        submitting: false,
      }));
      void get().refreshAudit();
      return report;
    } catch (e) {
      set((s) => ({
        messages: s.messages.map((m) => (m.runId === runId ? { ...m, error: String((e as Error).message), done: true } : m)),
        activeRunId: null,
        submitting: false,
      }));
      throw e;
    }
  },

  setStage: (runId, stage, status, durationMs, detail) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.runId === runId
          ? { ...m, stages: { ...m.stages, [stage]: { status, durationMs, detail, at: Date.now() } } }
          : m
      ),
    })),

  failedRun: (runId, error) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.runId === runId ? { ...m, error, done: true, stages: m.stages } : m)),
      activeRunId: null,
      submitting: false,
    })),

  catalog: null,
  policy: null,
  audit: null,

  refreshCatalog: async (role) => {
    const { api } = await import('./lib/api');
    set({ catalog: await api.catalog(role) });
  },
  refreshPolicy: async () => {
    const { api } = await import('./lib/api');
    set({ policy: await api.policies() });
  },
  savePolicy: async (p) => {
    const { api } = await import('./lib/api');
    set({ policy: await api.savePolicies(p) });
  },
  refreshAudit: async () => {
    const { api } = await import('./lib/api');
    set({ audit: await api.audit() });
  },
}));