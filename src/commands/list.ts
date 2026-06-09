import { getProject, listVaultSecrets } from '../db/queries.js';
import { logger } from '../utils/logger.js';

interface ListOptions {
  env?: string;
  json?: boolean;
}

export function listCommand(projectId: string, options: ListOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    logger.raw(`  Run: devassets add-project ${projectId} --path=<path>`);
    process.exit(1);
  }

  const secrets = listVaultSecrets(projectId, options.env);

  if (options.json) {
    logger.raw(JSON.stringify(secrets, null, 2));
    return;
  }

  if (secrets.length === 0) {
    logger.info(`No secrets stored for ${project.name}${options.env ? ` [${options.env}]` : ''}`);
    logger.raw(`  Run: devassets set ${projectId} <KEY> to add one`);
    return;
  }

  logger.raw(`\nSecrets for ${project.name}${options.env ? ` [${options.env}]` : ''}\n`);

  const byEnv = new Map<string, typeof secrets>();
  for (const s of secrets) {
    if (!byEnv.has(s.env)) byEnv.set(s.env, []);
    byEnv.get(s.env)!.push(s);
  }

  for (const [env, entries] of byEnv) {
    if (!options.env) logger.raw(`  [${env}]`);
    for (const s of entries) {
      const hints = [s.provider, s.accountHint, s.workspaceHint].filter(Boolean).join(' · ');
      const updated = s.updatedAt.slice(0, 10);
      logger.raw(`    ${s.key.padEnd(32)} ${hints ? `(${hints})` : ''}  ${updated}`);
    }
  }
  logger.raw('');
}
