import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import { listProjects, getProject, getAssets, getPaymentPlatforms, getAuditLogs, getCredentialIdentities } from '../db/queries.js';
import { validateAssets } from '../core/validator.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_UI_PORT } from '../utils/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface UiOptions {
  port?: string;
  noOpen?: boolean;
}

export function uiCommand(options: UiOptions) {
  const port = parseInt(options.port ?? String(DEFAULT_UI_PORT));
  const app = express();

  app.use(cors({ origin: `http://localhost:${port}` }));
  app.use(express.json());

  const uiDist = path.join(__dirname, '../../ui/dist');
  app.use(express.static(uiDist));

  app.get('/api/projects', (_req, res) => {
    try {
      const projects = listProjects();
      const enriched = projects.map(p => {
        const assets = getAssets(p.id);
        const result = validateAssets(assets, p.id);
        return { ...p, status: result.status, assetCount: assets.length };
      });
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/projects/:id', (req, res) => {
    try {
      const project = getProject(req.params.id);
      if (!project) { res.status(404).json({ error: 'Not found' }); return; }
      const assets = getAssets(req.params.id);
      const platforms = getPaymentPlatforms(req.params.id);
      const checkResult = validateAssets(assets, req.params.id);
      const identities = getCredentialIdentities(req.params.id);
      res.json({ ...project, checkResult, platforms, identities });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/projects/:id/assets', (req, res) => {
    try {
      const assets = getAssets(req.params.id, req.query.env as string | undefined);
      res.json(assets);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/projects/:id/audit', (req, res) => {
    try {
      const since = req.query.since ? parseInt(req.query.since as string) : undefined;
      const logs = getAuditLogs(req.params.id, since);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/audit', (_req, res) => {
    try {
      const projects = listProjects();
      const allLogs = projects.flatMap(p => getAuditLogs(p.id, 30));
      allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      res.json(allLogs);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiDist, 'index.html'));
  });

  app.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    logger.success(`DevAssets Dashboard running at ${url}`);
    if (!options.noOpen) open(url);
  });
}
