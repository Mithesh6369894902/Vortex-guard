import { Router } from 'express';
import { z } from 'zod';
import type { QueryEngine } from './db/engine';
import { loadCatalog } from './catalog/index';
import { readPolicy, writePolicy } from './governance/index';
import { auditFeed } from './pipeline/audit';
import { runAnalysis } from './pipeline/orchestrator';

const analyzeSchema = z.object({
  question: z.string().min(3, 'question must be at least 3 characters'),
  role: z.string().default('analyst'),
  runId: z.string().optional(),
});

const policySchema = z.object({
  rules: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      action: z.enum(['allow', 'deny', 'mask']),
      scope: z.enum(['table', 'column']),
      target: z.string(),
      reason: z.string(),
      enabled: z.boolean(),
    })
  ),
});

export function buildRouter(dbProvider: QueryEngine | (() => Promise<QueryEngine>)): Router {
  const r = Router();
  const db = () => (typeof dbProvider === 'function' ? dbProvider() : Promise.resolve(dbProvider));

  r.post('/analyze', async (req, res) => {
    const parsed = analyzeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', detail: parsed.error.flatten() });
      return;
    }
    const { question, role, runId } = parsed.data;
    try {
      const report = await runAnalysis(await db(), {
        question,
        role,
        runId: runId ?? cryptoRandom(),
      });
      res.json(report);
    } catch (e) {
      res.status(500).json({ error: String((e as Error).message ?? e) });
    }
  });

  r.get('/catalog', async (req, res) => {
    const role = (req.query.role as string) ?? 'analyst';
    const catalog = await loadCatalog(await db());
    res.json({ ...catalog, applied: readPolicy(), role });
  });

  r.get('/policies', (_req, res) => {
    res.json(readPolicy());
  });

  r.put('/policies', async (req, res) => {
    const parsed = policySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_policy', detail: parsed.error.flatten() });
      return;
    }
    const saved = writePolicy({ ...readPolicy(), rules: parsed.data.rules });
    res.json(saved);
  });

  r.get('/audit', async (_req, res) => {
    res.json(await auditFeed(await db()));
  });

  r.get('/health', async (_req, res) => {
    const e = await db();
    let ok = true;
    try {
      await e.query('SELECT 1');
    } catch {
      ok = false;
    }
    res.json({ ok, engine: e.kind });
  });

  return r;
}

function cryptoRandom(): string {
  return 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}