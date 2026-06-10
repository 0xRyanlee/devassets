import path from 'path';
import fs from 'fs';
import { upsertProject, getProject } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { slugify } from '../utils/slug.js';
import type { ProjectType } from '../types/index.js';

interface AddProjectOptions {
  path?: string;
  type?: string;
  id?: string;
}

export function addProjectCommand(name: string, options: AddProjectOptions) {
  const projectPath = options.path
    ? path.resolve(options.path)
    : path.join(process.cwd(), name);

  const type = (options.type ?? 'other') as ProjectType;
  const computed = options.id ?? slugify(name);

  if (computed === 'project' && name !== 'project') {
    logger.error(`Cannot derive a valid ID from "${name}". Use --id to specify one explicitly.`);
    process.exit(1);
  }
  const id = computed;

  if (id === '_global') {
    logger.error('"_global" is a reserved ID for account-level credentials.');
    logger.raw('  Use: devassets set _global <KEY> to store global credentials');
    process.exit(1);
  }

  if (!fs.existsSync(projectPath)) {
    logger.warn(`Path does not exist: ${projectPath}`);
    logger.warn('Project will be registered but scanning will fail until the path exists.');
  }

  const existing = getProject(id);
  if (existing && existing.name !== name) {
    logger.error(`ID "${id}" is already used by project "${existing.name}". Use --id to specify a unique ID.`);
    process.exit(1);
  }

  upsertProject({ id, name, path: projectPath, type });

  if (existing) {
    logger.success(`Updated project: ${name} (${id})`);
  } else {
    logger.success(`Added project: ${name} (${id})`);
  }

  logger.raw(`  ID:   ${id}`);
  logger.raw(`  Path: ${projectPath}`);
  logger.raw(`  Type: ${type}`);
  logger.raw('');
  logger.raw(`Next: devassets scan ${id}`);
}
