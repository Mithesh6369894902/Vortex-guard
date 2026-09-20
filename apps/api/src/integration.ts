/**
 * End-to-end integration test: boots the real app against the seeded warehouse
 * and exercises the full Guardian pipeline for a set of probing questions,
 * including the "silent failure" trap cases.
 */
import dotenv from 'dotenv';
dotenv.config();
import http from 'node:http';
import { getEngine, disposeEngine } from './db/index';
import { buildApp } from './app';

const QUESTIONS: Array<{ q: string; role?: string }> = [
  { q: 'What is the total revenue for the last 90 days?' },
  { q: 'Average order value this month' },
  { q: 'How many orders were placed in the last 30 days?' },
  { q: 'Show me the breakdown of sales by category' },
  { q: 'List the 10 most recent orders' },
  { q: 'Show me the email and phone numbers of recent customers' },
  { q: 'Give me the customer churn rate for the last 5 years' },
  { q: 'What was the total GMV including the payments table data?' },
  { q: 'Could you show all aadhaar numbers of VIP customers?' },
];

async function main() {
  const db = await getEngine();
  const app = buildApp(db);
  const server = http.createServer(app);
  await new Promise<void>((res) => server.listen(0, res));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api`;

  const j = (r: Response) => r.json();

  // health + catalog
  const health = await fetch(`${base}/health`).then(j);
  console.log('health:', JSON.stringify(health));

  const catalog = await fetch(`${base}/catalog?role=analyst`).then(j);
  console.log(`catalog: ${catalog.tables.length} tables, sensitivities:`, $S(catalog.tables));

  const stats: Record<string, string> = {};
  for (const t of QUESTIONS) {
    const res = await fetch(`${base}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: t.q, role: t.role ?? 'analyst', runId: 'it-' + Math.random().toString(36).slice(2, 8) }),
    });
    const rep = await res.json();
    if (!rep.verdict) { console.log('\n❌ FAILED RESPONSE for', JSON.stringify(t.q), JSON.stringify(rep).slice(0, 300)); continue; }
const fails = rep.checks.filter((c: any) => c.status === 'failed').length;
    const warns = rep.checks.filter((c: any) => c.status === 'warned').length;
    const kind = rep.answerKind ?? '?';
    stats[rep.verdict] = (stats[rep.verdict] ?? 0) + 1;
    console.log(
      `\n• ${t.q}\n  verdict=${rep.verdict.toUpperCase()}  score=${rep.trustScore}  checks[f=${fails}/w=${warns}]  intent=${rep.intent}  kind=${kind}\n  → ${rep.answerSummary.slice(0, 180)}`
    );
    for (const c of rep.checks.filter((c: any) => c.status !== 'passed')) {
      console.log(`    CHECK [${c.status}/${c.severity}] ${c.title}: ${String(c.detail).slice(0, 120)}`);
    }
    if (rep.verified?.length) {
      for (const v of rep.verified) console.log(`    claim [${v.status}] ${v.metric}: asserted=${v.assertedValue} truth=${v.groundTruth} Î”${v.deltaPct ?? '-'}%`);
    }
  }

  console.log('\n===== verdict distribution =====');
  console.log(JSON.stringify(stats));

  const aud = await fetch(`${base}/audit`).then(j);
  console.log(`audit: total=${aud.total} today=${JSON.stringify(aud.today)}`);

  server.close();
  await disposeEngine();
}

function $S(tables: any[]): string {
  const out = new Set<string>();
  for (const t of tables) for (const c of t.columns) out.add(c.sensitivity);
  return [...out].join(',');
}

main().catch((e) => { console.error('integration failed:', e); process.exit(1); });