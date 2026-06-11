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

  // Merge global vault first so project-specific keys take precedence
  const globalAll = projectId === '_global' ? [] : listVaultSecrets('_global', env);
  // Project keys shadow global keys with the same name
  const projectKeys = new Set(all.map(s => s.key));
  const globalOnly = globalAll.filter(s => !projectKeys.has(s.key));
  const merged = [...globalOnly, ...all];

  const targets = options.keys && options.keys.length > 0
    ? merged.filter(s => options.keys!.includes(s.key))
    : merged;

  if (targets.length === 0) {
    logger.info(`No secrets to inject for ${project.name} [${env}]`);
    return;
  }

  const injected: string[] = [];
  for (const meta of targets) {
    const sourceProjectId = globalOnly.some(g => g.key === meta.key) ? '_global' : projectId;
    const value = getVaultSecret(sourceProjectId, env, meta.key);
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
      // Single-quote wrap: safe for all shell meta-chars ($, `, \, !, etc.)
      // The only character that requires escaping inside single quotes is ' itself
      const escaped = (process.env[key] ?? '').replace(/'/g, "'\\''");
      logger.raw(`export ${key}='${escaped}'`);
    }
  } else {
    logger.success(`Injected ${injected.length} secret(s) into environment [${env}]`);
  }
}
