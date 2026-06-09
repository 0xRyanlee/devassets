import { getProject, deleteVaultSecret } from '../db/queries.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';

interface UnsetOptions {
  env?: string;
  yes?: boolean;
}

export async function unsetCommand(projectId: string, key: string, options: UnsetOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const env = options.env ?? 'local';

  if (!options.yes) {
    const confirmed = await confirm(`Delete ${key} [${env}] from ${project.name}? (y/N) `);
    if (!confirmed) {
      logger.info('Cancelled.');
      return;
    }
  }

  const deleted = deleteVaultSecret(projectId, env, key);

  if (!deleted) {
    logger.error(`Secret not found: ${key} [${env}]`);
    process.exit(1);
  }

  addAuditLog({
    projectId,
    action: 'unset',
    user: getCurrentUser(),
    timestamp: new Date().toISOString(),
    details: { key, env },
    result: 'success',
  });

  logger.success(`Deleted ${key} [${env}] from ${project.name}`);
}

function confirm(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (chunk) => {
      process.stdin.pause();
      resolve(chunk.toString().trim().toLowerCase() === 'y');
    });
  });
}
