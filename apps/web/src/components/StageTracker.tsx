import type { PipelineStage, StageStatus } from '@vertexguard/shared';
import { STAGES_ORDER } from '@vertexguard/shared';
import {
  CircleCheck, CircleX, CircleAlert, Loader2, Brain, ShieldCheck, UserCheck,
  Database, Scale, ChartNoAxesCombined, ListChecks, HardDriveDownload,
} from 'lucide-react';
import type { StageState } from '../store';
import { formatDuration } from '../lib/format';

const ICONS: Record<PipelineStage, typeof Brain> = {
  planning: Brain,
  guard: ShieldCheck,
  governance: UserCheck,
  execution: Database,
  verification: Scale,
  statistics: ChartNoAxesCombined,
  report: ListChecks,
  persisted: HardDriveDownload,
};

const NUMBERS: Record<PipelineStage, string> = {
  planning: '01',
  guard: '02',
  governance: '03',
  execution: '04',
  verification: '05',
  statistics: '06',
  report: '07',
  persisted: '08',
};

const LABEL: Record<PipelineStage, string> = {
  planning: 'Planning & Intent',
  guard: 'SQL Guardian',
  governance: 'Policy & Redaction',
  execution: 'Warehouse Query',
  verification: 'Ground-Truth Proof',
  statistics: 'Anomaly Audit',
  report: 'Trust Scoring',
  persisted: 'Immutable Anchor',
};

export function StageTracker({ stages }: { stages: Partial<Record<PipelineStage, StageState>> }) {
  return (
    <div className="pl-4 md:pl-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {STAGES_ORDER.map((stage) => {
        const st = stages[stage] ?? { status: 'idle' as const, at: 0 };
        const Icon = ICONS[stage];
        const num = NUMBERS[stage];

        const isRunning = st.status === 'running';
        const isPassed = st.status === 'passed';
        const isFailed = st.status === 'failed';
        const isWarned = st.status === 'warned';

        let cardBg = 'bg-positivus-grey text-positivus-dark border-positivus-border';
        let badgeBg = 'bg-white text-positivus-dark';
        if (isRunning) {
          cardBg = 'bg-positivus-green text-positivus-dark border-positivus-border shadow-positivus-sm animate-pulse';
          badgeBg = 'bg-positivus-dark text-positivus-green';
        } else if (isPassed) {
          cardBg = 'bg-positivus-green text-positivus-dark border-positivus-border shadow-positivus-sm';
          badgeBg = 'bg-positivus-dark text-white';
        } else if (isFailed) {
          cardBg = 'bg-rose-100 text-rose-950 border-positivus-border';
          badgeBg = 'bg-rose-600 text-white';
        } else if (isWarned) {
          cardBg = 'bg-amber-100 text-amber-950 border-positivus-border';
          badgeBg = 'bg-amber-500 text-white';
        }

        return (
          <div
            key={stage}
            className={`rounded-2xl border px-3.5 py-2.5 flex items-center gap-3 transition-all ${cardBg}`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${badgeBg}`}>
              {isRunning ? <Loader2 size={12} className="animate-spin" /> : num}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold truncate flex items-center gap-1.5">
                <Icon size={13} className="shrink-0" />
                <span className="truncate">{LABEL[stage]}</span>
              </div>
              <div className="text-[10px] text-zinc-600 font-medium truncate">{statusWord(st)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function statusWord(st: StageState): string {
  switch (st.status) {
    case 'running':
      return 'Processing in flight…';
    case 'passed':
      return st.durationMs ? `${formatDuration(st.durationMs)} · passed` : 'completed';
    case 'failed':
      return st.durationMs ? `${formatDuration(st.durationMs)} · blocked` : 'blocked';
    case 'warned':
      return st.durationMs ? `${formatDuration(st.durationMs)} · flagged` : 'warnings';
    default:
      return 'queued';
  }
}

export function StatusIcon({ status }: { status: StageStatus | 'idle' }) {
  if (status === 'passed') return <CircleCheck size={16} className="text-positivus-dark" />;
  if (status === 'failed') return <CircleX size={16} className="text-rose-600" />;
  if (status === 'warned') return <CircleAlert size={16} className="text-amber-600" />;
  if (status === 'running') return <Loader2 size={16} className="text-positivus-dark animate-spin" />;
  return <CircleAlert size={16} className="text-zinc-400" />;
}
