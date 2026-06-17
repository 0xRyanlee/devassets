import { getProject, getVaultSecret, getGlobalSecret } from '../db/queries.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_ENV } from '../utils/constants.js';

interface GetOptions {
  env?: string;
  raw?: boolean;
}

export function getCommand(projectId: string, key: string, options: GetOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    logger.raw(`  Run: devassets add-project ${projectId} --path=<path>`);
    process.exit(1);
  }

  const env = options.env ?? DEFAULT_ENV;
  let value: string | undefined;
  let sourceProject = projectId;
  try {
    value = getVaultSecret(projectId, env, key);
    // Fall back to global vault for account-level credentials
    if (value === undefined && projectId !== '_global') {
      value = getGlobalSecret(key, env);
      if (value !== undefined) sourceProject = '_global';
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (value === undefined) {
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
    details: { key, env, ...(sourceProject !== projectId ? { fallbackFrom: projectId } : {}) },
    result: 'success',
  });

  if (options.raw) {
    process.stdout.write(value);
  } else {
    logger.raw(value);
  }
}
