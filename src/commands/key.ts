import fs from 'fs';
import path from 'path';
import { encryptAES, decryptAES } from '../utils/crypto.js';
import { SIGNATURE_KEY_PATH } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { addAuditLog, getCurrentUser } from '../db/queries.js';
import { isSameFile } from '../utils/fs-safety.js';

// Writes via a same-directory temp file + atomic rename, verifying the full byte count was
// written before renaming over the target. A crash or short write mid-operation leaves the
// original target file untouched instead of a truncated/corrupted key or backup.
function atomicWriteFile(targetPath: string, data: Buffer, mode: number) {
  const tmpPath = `${targetPath}.${process.pid}.tmp`;
  const fd = fs.openSync(tmpPath, fs.constants.O_CREAT | fs.constants.O_WRONLY | fs.constants.O_TRUNC, mode);
  try {
    const written = fs.writeSync(fd, data);
    if (written !== data.length) {
      throw new Error(`Short write: wrote ${written} of ${data.length} bytes to ${tmpPath}`);
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, targetPath);
}

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

  const outputPath = path.resolve(options.output ?? `devassets-key-backup-${new Date().toISOString().split('T')[0]}.enc`);

  // Reading signature.key then O_TRUNC-writing the encrypted backup over that SAME path (directly,
  // or via a symlink/hardlink) would overwrite the real 32-byte key with ciphertext text — which
  // still passes getSignatureKey()'s length check, so it'd be silently treated as the new key and
  // every existing vault secret would become permanently undecryptable.
  if (fs.existsSync(outputPath) && isSameFile(outputPath, SIGNATURE_KEY_PATH)) {
    logger.error(`--output must not be signature.key itself (or a symlink/hardlink to it): ${outputPath}`);
    process.exit(1);
  }

  const keyBytes = fs.readFileSync(SIGNATURE_KEY_PATH);
  const encrypted = encryptAES(keyBytes.toString('base64'), options.encryptFor);
  atomicWriteFile(outputPath, Buffer.from(encrypted), 0o600);

  addAuditLog({ projectId: '_global', action: 'key-export', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { outputPath }, result: 'success' });

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
    addAuditLog({ projectId: '_global', action: 'key-restore', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { file, error: 'decrypt failed' }, result: 'failure' });
    logger.error('Could not decrypt backup — wrong password, or the file is corrupted.');
    process.exit(1);
  }
  if (keyBytes.length !== 32) {
    addAuditLog({ projectId: '_global', action: 'key-restore', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { file, error: 'unexpected key length' }, result: 'failure' });
    logger.error(`Decrypted key is ${keyBytes.length} bytes (expected 32) — backup file may be corrupted.`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(SIGNATURE_KEY_PATH), { recursive: true });
  atomicWriteFile(SIGNATURE_KEY_PATH, keyBytes, 0o600);

  addAuditLog({ projectId: '_global', action: 'key-restore', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { file }, result: 'success' });

  logger.success('Signature key restored from backup.');
  logger.raw('  Vault secrets encrypted under this key are decryptable again.');
}
