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

  // Merge global vault; project-specific keys take precedence over global
  const globalAll = projectId === '_global' ? [] : listVaultSecrets('_global', env);
  const projectKeys = new Set(all.map(s => s.key));
  const globalOnly = globalAll.filter(s => !projectKeys.has(s.key));
  const merged = [...globalOnly, ...all];

  const targets = options.keys && options.keys.length > 0
    ? merged.filter(s => options.keys!.includes(s.key))
    : merged;

  if (targets.length === 0) {
    logger.warn(`No secrets found for ${project.name} [${env}]; running without injection`);
  }

  const injected: Record<string, string> = {};
  for (const meta of targets) {
    const sourceProjectId = globalOnly.some(g => g.key === meta.key) ? '_global' : projectId;
    try {
      const value = getVaultSecret(sourceProjectId, env, meta.key);
      if (value !== undefined) injected[meta.key] = value;
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  const child = spawnSync(args[0], args.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, ...injected },
  });

  if (child.error) {
    logger.error(`Failed to start command: ${child.error.message}`);
    process.exit(127);
  }

  if (child.signal) {
    // POSIX convention: 128 + signal number
    const sigMap: Record<string, number> = { SIGTERM: 15, SIGKILL: 9, SIGINT: 2, SIGHUP: 1 };
    const sigNum = sigMap[child.signal] ?? 1;
    logger.error(`Process killed by ${child.signal}`);
    process.exit(128 + sigNum);
  }

  process.exit(child.status ?? 1);
}
