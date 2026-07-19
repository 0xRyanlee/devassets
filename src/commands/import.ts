import path from 'path';
import fs from 'fs';
import { upsertProject, getProject, replaceAssets, upsertPaymentPlatform, addAuditLog, getCurrentUser } from '../db/queries.js';
import { scanProject } from '../core/scanner.js';
import { logger } from '../utils/logger.js';
import { slugify } from '../utils/slug.js';
import type { ProjectType } from '../types/index.js';

interface ImportOptions {
  root?: string;
  type?: string;
  scan?: boolean;
  dryRun?: boolean;
}

interface ImportResult {
  id: string;
  name: string;
  action: 'added' | 'updated' | 'skipped';
  reason?: string;
  assetsFound?: number;
}

export function importCommand(options: ImportOptions) {
  const root = path.resolve(options.root ?? process.cwd());
  const type = (options.type ?? 'other') as ProjectType;
  const shouldScan = options.scan !== false;

  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    logger.error(`Root directory does not exist: ${root}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .sort((a, b) => a.name.localeCompare(b.name));

  if (entries.length === 0) {
    logger.warn(`No subdirectories found under ${root}`);
    return;
  }

  const results: ImportResult[] = [];

  for (const entry of entries) {
    const projectPath = path.join(root, entry.name);
    const id = slugify(entry.name);

    if (id === '_global') {
      results.push({ id, name: entry.name, action: 'skipped', reason: '"_global" is reserved' });
      continue;
    }
    const existing = getProject(id);
    if (existing && existing.name !== entry.name && existing.path !== projectPath) {
      results.push({ id, name: entry.name, action: 'skipped', reason: `id "${id}" already used by a different project — register manually with --id` });
      continue;
    }

    if (options.dryRun) {
      results.push({ id, name: entry.name, action: existing ? 'updated' : 'added' });
      continue;
    }

    upsertProject({ id, name: entry.name, path: projectPath, type });

    let assetsFound: number | undefined;
    if (shouldScan) {
      try {
        const scanResult = scanProject(id, projectPath);
        replaceAssets(id, scanResult.assets);
        for (const platform of scanResult.detectedPlatforms) {
          upsertPaymentPlatform({ projectId: id, name: platform, status: 'unconfigured' });
        }
        addAuditLog({ projectId: id, action: 'scan', user: getCurrentUser(), timestamp: scanResult.scannedAt, details: { via: 'import', assetsFound: scanResult.assets.length }, result: 'success' });
        assetsFound = scanResult.assets.length;
      } catch {
        // A single project's scan failing shouldn't abort the whole batch — devassets doctor
        // surfaces per-project scan errors afterward.
      }
    }

    results.push({ id, name: entry.name, action: existing ? 'updated' : 'added', assetsFound });
  }

  printResults(root, results, !!options.dryRun, shouldScan);
}

function printResults(root: string, results: ImportResult[], dryRun: boolean, scanned: boolean) {
  logger.info(`${dryRun ? 'Would import' : 'Imported'} from ${root}`);
  logger.raw('');

  for (const r of results) {
    if (r.action === 'skipped') {
      logger.raw(`  ⊘ ${r.name.padEnd(24)} skipped — ${r.reason}`);
      continue;
    }
    const verb = r.action === 'added' ? 'added  ' : 'updated';
    const assets = r.assetsFound !== undefined ? ` · ${r.assetsFound} assets` : '';
    logger.raw(`  ✓ ${r.name.padEnd(24)} ${verb}${assets}`);
  }

  const added = results.filter(r => r.action === 'added').length;
  const updated = results.filter(r => r.action === 'updated').length;
  const skipped = results.filter(r => r.action === 'skipped').length;

  logger.raw('');
  logger.raw(`${added} added, ${updated} updated, ${skipped} skipped`);
  if (dryRun) {
    logger.raw('');
    logger.raw('This was a dry run — nothing was registered. Re-run without --dry-run to apply.');
  } else {
    logger.raw('');
    logger.raw(scanned ? 'Next: devassets doctor' : 'Next: devassets scan <project>, or devassets doctor for an overview');
  }
}
