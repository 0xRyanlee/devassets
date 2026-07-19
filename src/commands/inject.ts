import { getProject, resolveInjectionTargets, addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';

interface InjectOptions {
  env?: string;
  keys?: string[];
  print?: boolean;
}

export function injectCommand(projectId: string, options: InjectOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const env = options.env ?? 'local';
  const resolved = resolveInjectionTargets(projectId, env, options.keys);

  if (resolved.length === 0) {
    logger.info(`No secrets to inject for ${project.name} [${env}]`);
    return;
  }

  for (const { key, value } of resolved) {
    process.env[key] = value;
  }
  const injected = resolved.map(r => r.key);

  addAuditLog({
    projectId,
    action: 'inject',
    user: getCurrentUser(),
    timestamp: new Date().toISOString(),
    details: { env, keys: injected },
    result: 'success',
  });

  if (options.print) {
    for (const key of injected) {
      // Single-quote wrap: safe for all shell meta-chars ($, `, \, !, etc.)
      // The only character that requires escaping inside single quotes is ' itself
      const escaped = (process.env[key] ?? '').replace(/'/g, "'\\''");
      logger.raw(`export ${key}='${escaped}'`);
    }
  } else {
    logger.success(`Injected ${injected.length} secret(s) into environment [${env}]`);
  }
}
