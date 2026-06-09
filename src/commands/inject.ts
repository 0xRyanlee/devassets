import { getProject, listVaultSecrets, getVaultSecret } from '../db/queries.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
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
  const all = listVaultSecrets(projectId, env);
  const targets = options.keys && options.keys.length > 0
    ? all.filter(s => options.keys!.includes(s.key))
    : all;

  if (targets.length === 0) {
    logger.info(`No secrets to inject for ${project.name} [${env}]`);
    return;
  }

  const injected: string[] = [];
  for (const meta of targets) {
    const value = getVaultSecret(projectId, env, meta.key);
    if (value === undefined) continue;
    process.env[meta.key] = value;
    injected.push(meta.key);
  }

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
      logger.raw(`export ${key}="${(process.env[key] ?? '').replace(/"/g, '\\"')}"`);
    }
  } else {
    logger.success(`Injected ${injected.length} secret(s) into environment [${env}]`);
  }
}
