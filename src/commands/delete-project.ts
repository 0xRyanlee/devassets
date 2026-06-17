import readline from 'readline';
import { getProject, deleteProject } from '../db/queries.js';
import { logger } from '../utils/logger.js';

interface DeleteProjectOptions {
  force?: boolean;
}

export async function deleteProjectCommand(projectId: string, options: DeleteProjectOptions) {
  if (projectId === '_global') {
    logger.error('Cannot delete the _global project.');
    process.exit(1);
  }

  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  if (!options.force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question(`Delete project "${project.name}" (${projectId}) and all its vault secrets? [y/N] `, resolve);
    });
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      logger.raw('Cancelled.');
      process.exit(0);
    }
  }

  deleteProject(projectId);
  logger.success(`Deleted: ${project.name}`);
  logger.raw('  Vault secrets, assets, and audit records for this project have been removed.');
}
