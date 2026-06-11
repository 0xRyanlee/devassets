import { getProject, listVaultSecrets, deleteVaultSecret } from '../db/queries.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { isCI } from '../utils/env.js';
import readline from 'readline';

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

  // Preflight: verify key exists before asking for confirmation
  const existing = listVaultSecrets(projectId, env).find(s => s.key === key);
  if (!existing) {
    logger.error(`Secret not found: ${key} [${env}]`);
    process.exit(1);
  }

  if (!options.yes) {
    if (!process.stdin.isTTY || isCI()) {
      logger.error('Interactive prompt required. Use --yes to bypass confirmation in non-TTY/CI environments.');
      process.exit(1);
    }
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
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
