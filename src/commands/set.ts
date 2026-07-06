import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { getProject, setVaultSecret } from '../db/queries.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { isCI } from '../utils/env.js';
import { DEFAULT_ENV, suggestScope } from '../utils/constants.js';

interface SetOptions {
  env?: string;
  provider?: string;
  account?: string;
  file?: string;
}

function isBinaryBuffer(buf: Buffer): boolean {
  // Heuristic: presence of null bytes or high proportion of non-printable bytes → binary
  for (let i = 0; i < Math.min(buf.length, 8192); i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

export async function setCommand(projectId: string, key: string, value: string | undefined, options: SetOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    logger.raw(`  Run: devassets add-project ${projectId} --path=<path>`);
    process.exit(1);
  }

  const env = options.env ?? DEFAULT_ENV;
  let secretValue: string;
  let encoding: 'utf8' | 'base64' = 'utf8';
  let filename: string | undefined;

  if (options.file) {
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      logger.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const buf = fs.readFileSync(filePath);
    filename = path.basename(filePath);
    if (isBinaryBuffer(buf)) {
      encoding = 'base64';
      secretValue = buf.toString('base64');
    } else {
      encoding = 'utf8';
      secretValue = buf.toString('utf8');
    }
    logger.info(`Loading ${filename} (${encoding}) → ${key} [${env}]`);
  } else {
    let rawValue = value;
    // Warn when value is passed as a CLI argument — it will appear in shell history
    if (rawValue && !isCI()) {
      process.stderr.write(`  Warning: secret value visible in shell history. Omit the value to use masked interactive input.\n`);
    }
    if (!rawValue) {
      rawValue = await promptSecret(`Enter value for ${key} (${env}): `);
      if (!rawValue || rawValue.trim() === '') {
        logger.error('No value provided.');
        process.exit(1);
      }
    }
    secretValue = rawValue;
  }

  const isGlobal = projectId === '_global';
  const scopeHint = suggestScope(key);
  if (!isGlobal && scopeHint === 'global' && !isCI()) {
    process.stderr.write(`  Hint: "${key}" looks like an account-level credential shared across projects. Consider: devassets set _global ${key}\n`);
  }
  if (isGlobal && scopeHint === 'project-only' && !isCI()) {
    process.stderr.write(`  Warning: "${key}" looks like a per-application secret (DB connection, signing key, JWT/session/webhook secret), not an account-level credential. Storing it in _global makes it fall back into every other project's get/inject/run. Consider: devassets set <project> ${key}\n`);
  }

  setVaultSecret(projectId, env, key, secretValue, {
    provider: options.provider,
    account: options.account,
    encoding,
    filename,
  }, isGlobal ? 'global' : 'project');

  addAuditLog({
    projectId,
    action: 'set',
    user: getCurrentUser(),
    timestamp: new Date().toISOString(),
    details: { key, env, ...(filename ? { filename, encoding } : {}) },
    result: 'success',
  });

  const fileHint = filename ? ` (file: ${filename})` : '';
  logger.success(`Stored ${key} for ${project.name} [${env}]${fileHint}`);
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
