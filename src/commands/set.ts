import readline from 'readline';
import { getProject, setVaultSecret } from '../db/queries.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';

interface SetOptions {
  env?: string;
  provider?: string;
  account?: string;
}

export async function setCommand(projectId: string, key: string, value: string | undefined, options: SetOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    logger.raw(`  Run: devassets add-project ${projectId} --path=<path>`);
    process.exit(1);
  }

  const env = options.env ?? 'local';
  let secretValue = value;

  if (!secretValue) {
    secretValue = await promptSecret(`Enter value for ${key} (${env}): `);
    if (!secretValue || secretValue.trim() === '') {
      logger.error('No value provided.');
      process.exit(1);
    }
  }

  setVaultSecret(projectId, env, key, secretValue, {
    provider: options.provider,
    account: options.account,
  });

  addAuditLog({
    projectId,
    action: 'set',
    user: getCurrentUser(),
    timestamp: new Date().toISOString(),
    details: { key, env },
    result: 'success',
  });

  logger.success(`Stored ${key} for ${project.name} [${env}]`);
}

function promptSecret(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdout.write(prompt);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      // setEncoding ensures multi-byte UTF-8 sequences (CJK, emoji) are assembled correctly
      process.stdin.setEncoding('utf8');
      let value = '';
      const handler = (char: string) => {
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode!(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          resolve(value);
        } else if (char === '\x03') {
          process.exit(0);
        } else if (char === '\x7f' || char === '\x08') {
          // backspace / ctrl+H
          value = value.slice(0, -1);
        } else if (char >= ' ' || char.codePointAt(0)! > 127) {
          // printable ASCII or any non-ASCII (multi-byte already assembled by setEncoding)
          value += char;
        }
      };
      process.stdin.on('data', handler);
    } else {
      // Non-TTY fallback (pipe/test)
      const rl = readline.createInterface({ input: process.stdin });
      process.stdout.write(prompt);
      rl.once('line', (line) => { rl.close(); resolve(line); });
    }
  });
}
