import { spawnSync } from 'child_process';
import { getProject, listVaultSecrets, getVaultSecret } from '../db/queries.js';
import { logger } from '../utils/logger.js';

interface RunOptions {
  env?: string;
  keys?: string[];
}

export function runCommand(projectId: string, args: string[], options: RunOptions) {
  if (args.length === 0) {
    logger.error('No command specified. Usage: devassets run <project> -- <cmd> [args...]');
    process.exit(1);
  }

  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const env = options.env ?? 'local';
  const all = listVaultSecrets(projectId, env);
  const targets = options.keys && options.keys.length > 0
    ? all.filter(s => options.keys!.includes(s.key))
    : all;

  const injected: Record<string, string> = {};
  for (const meta of targets) {
    const value = getVaultSecret(projectId, env, meta.key);
    if (value !== undefined) injected[meta.key] = value;
  }

  const child = spawnSync(args[0], args.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, ...injected },
  });

  process.exit(child.status ?? 1);
}
