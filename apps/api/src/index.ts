import dotenv from 'dotenv';
dotenv.config();

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import { getEngine } from './db/index';
import { SCHEMA_SQL } from './db/schema';
import { buildRouter } from './routes';
import { hub } from './pipeline/hub';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4100);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:4200';

async function boot() {
  const db = await getEngine();

  // Ensure schema exists without ever dropping live data.
  // The seeder is the only component allowed to recreate tables.
  try {
    const probe = await db.query(`SELECT to_regclass('public.audit_runs') AS t`);
    if (probe.rows[0]?.t == null) {
      await db.exec(SCHEMA_SQL);
      console.warn('[boot] schema created (empty warehouse - run `npm run seed`).');
    }
  } catch (e) {
    console.warn('[boot] schema init warning:', String((e as Error).message).split('\n')[0]);
  }

  const app = express();
  app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', buildRouter(() => Promise.resolve(db)));

  // Serve built frontend in production (single-binary deployment).
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api\/|ws).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    hub().add(ws);
    ws.send(JSON.stringify({ kind: 'welcome', engine: db.kind, at: new Date().toISOString() }));
  });

  const { loadCatalog } = await import('./catalog/index');
  const tables = await loadCatalog(db);

  server.listen(PORT, () => {
    console.log(`\n  VertexGuard API   http://localhost:${PORT}`);
    console.log(`  WebSocket relay   ws://localhost:${PORT}/ws`);
    console.log(`  Warehouse engine  ${db.kind === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : 'Embedded PostgreSQL (PGlite)'}`);
    console.log(`  Catalog tables    ${tables.tables.length}`);
  });
}

boot().catch((e) => {
  console.error('[boot] fatal:', e);
  process.exit(1);
});