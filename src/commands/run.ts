import { spawnSync } from 'child_process';
import { getProject, resolveInjectionTargets, addAuditLog, getCurrentUser } from '../db/queries.js';
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
  const resolved = resolveInjectionTargets(projectId, env, options.keys);

  if (resolved.length === 0) {
    logger.warn(`No secrets found for ${project.name} [${env}]; running without injection`);
  }

  const injected: Record<string, string> = {};
  for (const { key, value } of resolved) injected[key] = value;

  const child = spawnSync(args[0], args.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, ...injected },
  });

  if (child.error) {
    addAuditLog({
      projectId,
      action: 'run',
      user: getCurrentUser(),
      timestamp: new Date().toISOString(),
      details: { env, keys: Object.keys(injected), command: args[0] },
      result: 'failure',
    });
    logger.error(`Failed to start command: ${child.error.message}`);
    process.exit(127);
  }

  addAuditLog({
    projectId,
    action: 'run',
    user: getCurrentUser(),
    timestamp: new Date().toISOString(),
    details: { env, keys: Object.keys(injected), command: args[0], exitStatus: child.status, signal: child.signal ?? undefined },
    result: 'success',
  });

  if (child.signal) {
    // POSIX convention: 128 + signal number
    const sigMap: Record<string, number> = { SIGTERM: 15, SIGKILL: 9, SIGINT: 2, SIGHUP: 1 };
    const sigNum = sigMap[child.signal] ?? 1;
    logger.error(`Process killed by ${child.signal}`);
    process.exit(128 + sigNum);
  }

  process.exit(child.status ?? 1);
}
