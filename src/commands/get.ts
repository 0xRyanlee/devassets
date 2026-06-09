import { getProject, getVaultSecret } from '../db/queries.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';

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

  const env = options.env ?? 'local';
  let value: string | undefined;
  try {
    value = getVaultSecret(projectId, env, key);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (value === undefined) {
    logger.error(`Secret not found: ${key} [${env}]`);
    logger.raw(`  Run: devassets list ${projectId} to see stored keys`);
    process.exit(1);
  }

  addAuditLog({
    projectId,
    action: 'get',
    user: getCurrentUser(),
    timestamp: new Date().toISOString(),
    details: { key, env },
    result: 'success',
  });

  if (options.raw) {
    process.stdout.write(value);
  } else {
    logger.raw(value);
  }
}
