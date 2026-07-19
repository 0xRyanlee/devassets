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
  scanError?: string;
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
    // Path (not name) is the ground truth for "is this the same project being re-imported":
    // two different roots can each have a subdirectory with the same folder name (both slugify
    // to the same id) without being the same project. The old `&&`-of-both-differ check let a
    // same-named-different-path collision silently overwrite the existing project's path —
    // its vault secrets would stay under the same id but now point at the wrong directory.
    if (existing && existing.path !== projectPath) {
      results.push({ id, name: entry.name, action: 'skipped', reason: `id "${id}" already used by a different project (${existing.path}) — register manually with --id` });
      continue;
    }

    if (options.dryRun) {
      results.push({ id, name: entry.name, action: existing ? 'updated' : 'added' });
      continue;
    }

    upsertProject({ id, name: entry.name, path: projectPath, type });

    let assetsFound: number | undefined;
    let scanError: string | undefined;
    if (shouldScan) {
      try {
        const scanResult = scanProject(id, projectPath);
        replaceAssets(id, scanResult.assets);
        for (const platform of scanResult.detectedPlatforms) {
          upsertPaymentPlatform({ projectId: id, name: platform, status: 'unconfigured' });
        }
        addAuditLog({ projectId: id, action: 'scan', user: getCurrentUser(), timestamp: scanResult.scannedAt, details: { via: 'import', assetsFound: scanResult.assets.length }, result: 'success' });
        assetsFound = scanResult.assets.length;
      } catch (err) {
        // A single project's scan failing shouldn't abort the whole batch, but it must be
        // visible — silently showing "added" with 0 assets is indistinguishable from a
        // genuinely empty project, and nothing else records that the scan itself failed.
        scanError = err instanceof Error ? err.message : String(err);
        addAuditLog({ projectId: id, action: 'scan', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { via: 'import', error: scanError }, result: 'failure' });
      }
    }

    results.push({ id, name: entry.name, action: existing ? 'updated' : 'added', assetsFound, scanError });
  }

  printResults(root, results, !!options.dryRun, shouldScan);

  if (!options.dryRun && results.some(r => r.scanError)) {
    process.exitCode = 1;
  }
}

function printResults(root: string, results: ImportResult[], dryRun: boolean, scanned: boolean) {
  logger.info(`${dryRun ? 'Would import' : 'Imported'} from ${root}`);
  logger.raw('');

  for (const r of results) {
    if (r.action === 'skipped') {
      logger.raw(`  ⊘ ${r.name.padEnd(24)} skipped — ${r.reason}`);
      continue;
    }
    if (r.scanError) {
      logger.raw(`  ⚠ ${r.name.padEnd(24)} registered, but scan failed — ${r.scanError}`);
      continue;
    }
    const verb = r.action === 'added' ? 'added  ' : 'updated';
    const assets = r.assetsFound !== undefined ? ` · ${r.assetsFound} assets` : '';
    logger.raw(`  ✓ ${r.name.padEnd(24)} ${verb}${assets}`);
  }

  const added = results.filter(r => r.action === 'added' && !r.scanError).length;
  const updated = results.filter(r => r.action === 'updated' && !r.scanError).length;
  const skipped = results.filter(r => r.action === 'skipped').length;
  const scanFailed = results.filter(r => r.scanError).length;

  logger.raw('');
  logger.raw(`${added} added, ${updated} updated, ${skipped} skipped${scanFailed > 0 ? `, ${scanFailed} scan failed` : ''}`);
  if (dryRun) {
    logger.raw('');
    logger.raw('This was a dry run — nothing was registered. Re-run without --dry-run to apply.');
  } else {
    logger.raw('');
    logger.raw(scanned ? 'Next: devassets doctor' : 'Next: devassets scan <project>, or devassets doctor for an overview');
  }
}
