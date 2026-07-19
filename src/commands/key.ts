import fs from 'fs';
import path from 'path';
import { encryptAES, decryptAES } from '../utils/crypto.js';
import { SIGNATURE_KEY_PATH } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

interface KeyExportOptions {
  encryptFor?: string;
  output?: string;
}

// signature.key is the root of both HMAC signing and (via HKDF) vault AES encryption — losing it
// makes every previously-stored secret permanently undecryptable. This backs it up as a
// password-encrypted file so it can be restored later (devassets key-restore), the same AES
// primitive already used for `devassets export --encrypt-for`.
export function keyExportCommand(options: KeyExportOptions) {
  if (!options.encryptFor) {
    logger.error('--encrypt-for <password> is required — refusing to write an unencrypted key backup.');
    process.exit(1);
  }
  if (options.encryptFor.length < 8) {
    logger.error('Encryption password must be at least 8 characters.');
    process.exit(1);
  }
  if (!fs.existsSync(SIGNATURE_KEY_PATH)) {
    logger.error('No signature key found. Run "devassets init" first.');
    process.exit(1);
  }

  const keyBytes = fs.readFileSync(SIGNATURE_KEY_PATH);
  const encrypted = encryptAES(keyBytes.toString('base64'), options.encryptFor);
  const outputPath = path.resolve(options.output ?? `devassets-key-backup-${new Date().toISOString().split('T')[0]}.enc`);

  const fd = fs.openSync(outputPath, fs.constants.O_CREAT | fs.constants.O_WRONLY | fs.constants.O_TRUNC, 0o600);
  try {
    fs.writeSync(fd, encrypted);
  } finally {
    fs.closeSync(fd);
  }

  logger.success(`Signature key backed up to ${outputPath}`);
  logger.raw('');
  logger.warn('Store this file somewhere separate from this machine (password manager attachment,');
  logger.warn('encrypted cloud backup) — NOT next to signature.key itself. Anyone with this file AND');
  logger.warn('the password can decrypt your entire vault, so treat it with the same care as the vault itself.');
  logger.raw('');
  logger.raw(`Restore with: devassets key-restore ${path.basename(outputPath)} --password <password>`);
}

interface KeyRestoreOptions {
  password?: string;
  force?: boolean;
}

export function keyRestoreCommand(file: string, options: KeyRestoreOptions) {
  if (!options.password) {
    logger.error('--password <password> is required.');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    logger.error(`Backup file not found: ${file}`);
    process.exit(1);
  }
  if (fs.existsSync(SIGNATURE_KEY_PATH) && !options.force) {
    logger.error('A signature key already exists at ~/.devassets/signature.key.');
    logger.raw('  Overwriting it makes any vault secret encrypted under the CURRENT key permanently');
    logger.raw('  unreadable. Only proceed if you are intentionally restoring an older backup (e.g. onto');
    logger.raw('  a new machine, or recovering after deleting the current key). Use --force to proceed.');
    process.exit(1);
  }

  const encrypted = fs.readFileSync(file, 'utf-8').trim();
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(decryptAES(encrypted, options.password), 'base64');
  } catch {
    logger.error('Could not decrypt backup — wrong password, or the file is corrupted.');
    process.exit(1);
  }
  if (keyBytes.length !== 32) {
    logger.error(`Decrypted key is ${keyBytes.length} bytes (expected 32) — backup file may be corrupted.`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(SIGNATURE_KEY_PATH), { recursive: true });
  const fd = fs.openSync(SIGNATURE_KEY_PATH, fs.constants.O_CREAT | fs.constants.O_WRONLY | fs.constants.O_TRUNC, 0o600);
  try {
    fs.writeSync(fd, keyBytes);
  } finally {
    fs.closeSync(fd);
  }

  logger.success('Signature key restored from backup.');
  logger.raw('  Vault secrets encrypted under this key are decryptable again.');
}
