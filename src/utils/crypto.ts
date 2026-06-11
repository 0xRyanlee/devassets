import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  hkdfSync,
} from 'crypto';
import fs from 'fs';
import path from 'path';
import { SIGNATURE_KEY_PATH } from './constants.js';

export function getSignatureKey(): Buffer {
  if (!fs.existsSync(SIGNATURE_KEY_PATH)) {
    const key = randomBytes(32);
    fs.mkdirSync(path.dirname(SIGNATURE_KEY_PATH), { recursive: true });
    // Write with mode 0o600 atomically using open flags to avoid race window before chmod
    const fd = fs.openSync(SIGNATURE_KEY_PATH, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    try {
      fs.writeSync(fd, key);
    } finally {
      fs.closeSync(fd);
    }
    return key;
  }
  const key = fs.readFileSync(SIGNATURE_KEY_PATH);
  if (key.length < 32) {
    throw new Error(`Signature key at ${SIGNATURE_KEY_PATH} is corrupt (${key.length} bytes, expected 32). Delete it and run "devassets init" to regenerate.`);
  }
  return key;
}

export function signContent(content: string, timestamp: string): string {
  const key = getSignatureKey();
  return createHmac('sha256', key)
    .update(content + timestamp)
    .digest('hex');
}

export function verifySignature(content: string, timestamp: string, signature: string): boolean {
  try {
    const expected = signContent(content, timestamp);
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export function encryptAES(content: string, password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptAES(encrypted: string, password: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted format');

  const [saltHex, ivHex, authTagHex, encryptedData] = parts;
  if (![saltHex, ivHex, authTagHex, encryptedData].every(p => /^[0-9a-f]+$/i.test(p))) {
    throw new Error('Invalid encrypted format: non-hex segment');
  }
  const salt = Buffer.from(saltHex, 'hex');
  const key = scryptSync(password, salt, 32, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Vault key derived from signature key via HKDF — never used for HMAC signing
let _vaultKey: Buffer | null = null;

export function getVaultKey(): Buffer {
  if (!_vaultKey) {
    const sigKey = getSignatureKey();
    // HKDF separates signing and encryption domains: same IKM, different info label → independent keys.
    // Salt omitted (empty string) because sigKey is already a uniformly random 32-byte value (no need to extract).
    const derived = hkdfSync('sha256', sigKey, Buffer.from('devassets-vault-v1'), '', 32);
    _vaultKey = Buffer.from(derived);
  }
  return _vaultKey;
}

export function encryptVault(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
  const key = getVaultKey();
  const iv = randomBytes(12); // 96-bit IV for AES-GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  return { ciphertext, iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

export function decryptVault(ciphertext: string, iv: string, authTag: string): string {
  const key = getVaultKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function hashValue(value: string): string {
  const key = getSignatureKey();
  return createHmac('sha256', key)
    .update(value)
    .digest('hex')
    .slice(0, 16);
}
