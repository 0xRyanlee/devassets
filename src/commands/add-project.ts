import path from 'path';
import fs from 'fs';
import { upsertProject, getProject } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import type { ProjectType } from '../types/index.js';

interface AddProjectOptions {
  path?: string;
  type?: string;
}

export function addProjectCommand(name: string, options: AddProjectOptions) {
  const projectPath = options.path
    ? path.resolve(options.path)
    : path.join(process.cwd(), name);

  const type = (options.type ?? 'other') as ProjectType;
  const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  if (!fs.existsSync(projectPath)) {
    logger.warn(`Path does not exist: ${projectPath}`);
    logger.warn('Project will be registered but scanning will fail until the path exists.');
  }

  const existing = getProject(id);
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
