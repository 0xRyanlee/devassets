import chalk from 'chalk';
import { getProject, pinCredentialIdentity, addAuditLog, getCurrentUser } from '../db/queries.js';
import { resolveProjectIdentities } from '../core/identity.js';
import { logger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';

interface IdentityOptions {
  json?: boolean;
  pin?: boolean;
}

export async function identityCommand(projectId: string, options: IdentityOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const sp = createSpinner(`Resolving credential identities for ${project.name}…`, !options.json).start();

  try {
    const identities = await resolveProjectIdentities(project);
    sp.stop();

    if (options.pin) {
      for (const id of identities.filter(i => i.valid)) pinCredentialIdentity(projectId, id.keyName);
    }

    addAuditLog({
      projectId,
      action: 'identity',
      user: getCurrentUser(),
      timestamp: new Date().toISOString(),
      details: { resolved: identities.length, pinned: !!options.pin },
      result: 'success',
    });

    if (options.json) {
      console.log(JSON.stringify(identities, null, 2));
      return;
    }

    if (identities.length === 0) {
      logger.warn('No provider credentials detected (Vercel, Supabase, Neon, npm, Google Cloud).');
      logger.raw('Provider tokens are matched by env var name, e.g. VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN.');
      return;
    }

    console.log('');
    console.log(chalk.bold(`Credential Identities — ${project.name}`));
    console.log('');
    for (const id of identities) {
      const icon = id.mismatch ? chalk.red('⚠') : id.valid ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} ${chalk.cyan(id.keyName)}  ${chalk.gray(`(${id.provider})`)}`);
      if (!id.valid) {
        console.log(`      ${chalk.red(id.error ?? 'invalid')}`);
        continue;
      }
      if (id.account) console.log(`      account:   ${id.account}`);
      if (id.workspace) console.log(`      workspace: ${id.workspace}`);
      if (id.projects?.length) console.log(`      projects:  ${id.projects.join(', ')}`);
      if (id.mismatch) {
        console.log(chalk.red(`      ⚠ MISMATCH: expected account=${id.expectedAccount ?? '-'} workspace=${id.expectedWorkspace ?? '-'}`));
      }
    }
    console.log('');
    if (!options.pin && identities.some(i => i.valid && !i.expectedAccount && !i.expectedWorkspace)) {
      console.log(chalk.gray('Tip: once verified correct, run with --pin to lock the expected account/workspace; future drift will warn.'));
      console.log('');
    }
  } catch (err) {
    sp.fail(`Identity resolution failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
