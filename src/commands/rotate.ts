import { getProject, addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import readline from 'readline';

interface RotateOptions {
  confirm?: boolean;
  yes?: boolean;
}

export async function rotateCommand(projectId: string, keyName: string, options: RotateOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  if (!options.yes) {
    const confirmed = await promptConfirm(
      `Rotate ${keyName} for ${projectId}? This will record the intent and guide you through rotation. (y/N) `
    );
    if (!confirmed) {
      logger.raw('Aborted.');
      return;
    }
  }

  const timestamp = new Date().toISOString();

  addAuditLog({
    projectId,
    action: 'rotate',
    user: getCurrentUser(),
    timestamp,
    details: { keyName, status: 'initiated' },
    result: 'success',
  });

  logger.success(`Rotation initiated: ${keyName}`);
  logger.raw('');
  logger.raw('Manual steps required:');
  logger.raw(`  1. Generate a new ${keyName} in the relevant service dashboard`);
  if (projectId === '_global') {
    logger.raw(`  2. Store the new value: devassets set _global ${keyName}`);
  } else {
    logger.raw(`  2. Store the new value: devassets set ${projectId} ${keyName}`);
    logger.raw(`     (also update your .env file if the project reads from .env)`);
  }
  logger.raw(`  3. Deploy to pick up the new value`);
  if (projectId !== '_global') {
    logger.raw(`  4. Run: devassets scan ${projectId}  (to record the change)`);
  }
  logger.raw('');
  logger.warn('Rotation is recorded in audit log. Complete the manual steps above.');
}

function promptConfirm(question: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
