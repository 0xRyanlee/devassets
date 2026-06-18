import fs from 'fs';
import path from 'path';
import { getProject, getVaultSecretWithMeta, getGlobalSecret } from '../db/queries.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_ENV } from '../utils/constants.js';

interface GetOptions {
  env?: string;
  raw?: boolean;
  out?: string;
  mode?: string;
}

export function getCommand(projectId: string, key: string, options: GetOptions) {
  if (options.out && options.raw) {
    logger.error('--out and --raw are mutually exclusive.');
    process.exit(1);
  }

  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    logger.raw(`  Run: devassets add-project ${projectId} --path=<path>`);
    process.exit(1);
  }

  const env = options.env ?? DEFAULT_ENV;
  let meta: { value: string; encoding: 'utf8' | 'base64'; originalFilename?: string } | undefined;
  let sourceProject = projectId;
  try {
    meta = getVaultSecretWithMeta(projectId, env, key);
    // Fall back to global vault for account-level credentials
    if (meta === undefined && projectId !== '_global') {
      const globalVal = getGlobalSecret(key, env);
      if (globalVal !== undefined) {
        meta = { value: globalVal, encoding: 'utf8' };
        sourceProject = '_global';
      }
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (meta === undefined) {
    logger.error(`Secret not found: ${key} [${env}]`);
    logger.raw(`  Run: devassets list ${projectId} to see stored keys`);
    logger.raw(`  Or:  devassets list _global  (for account-level credentials)`);
    process.exit(1);
  }

  addAuditLog({
    projectId: sourceProject,
    action: 'get',
    user: getCurrentUser(),
    timestamp: new Date().toISOString(),
    details: { key, env, ...(sourceProject !== projectId ? { fallbackFrom: projectId } : {}), ...(options.out ? { materializedTo: options.out } : {}) },
    result: 'success',
  });

  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const fileMode = parseInt(options.mode ?? '600', 8);
    const data = meta.encoding === 'base64'
      ? Buffer.from(meta.value, 'base64')
      : Buffer.from(meta.value, 'utf8');
    fs.writeFileSync(outPath, data, { mode: fileMode });
    logger.success(`Materialized ${key} → ${outPath} (${meta.encoding === 'base64' ? 'binary' : 'text'}, mode ${(options.mode ?? '600')})`);
  } else if (options.raw) {
    process.stdout.write(meta.value);
  } else {
    logger.raw(meta.value);
  }
}
