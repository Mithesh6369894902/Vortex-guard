import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { QueryEngine } from './db/engine';
import { buildRouter } from './routes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildApp(db: QueryEngine, staticRoot?: string): express.Express {
  const app = express();
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:4200', credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', buildRouter(() => Promise.resolve(db)));

  const webDist = staticRoot ?? path.resolve(__dirname, '../../web/dist');
  if (staticRoot || fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api\/|ws).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }
  return app;
}