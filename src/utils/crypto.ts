import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import fs from 'fs';
import path from 'path';
import { SIGNATURE_KEY_PATH } from './constants.js';

export function getSignatureKey(): Buffer {
  if (!fs.existsSync(SIGNATURE_KEY_PATH)) {
    const key = randomBytes(32);
    fs.mkdirSync(path.dirname(SIGNATURE_KEY_PATH), { recursive: true });
    fs.writeFileSync(SIGNATURE_KEY_PATH, key);
    fs.chmodSync(SIGNATURE_KEY_PATH, 0o600);
    return key;
  }
  return fs.readFileSync(SIGNATURE_KEY_PATH);
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
  const key = scryptSync(password, salt, 32);
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
  const salt = Buffer.from(saltHex, 'hex');
  const key = scryptSync(password, salt, 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function hashValue(value: string): string {
  return createHmac('sha256', 'devassets-hash-salt')
    .update(value)
    .digest('hex')
    .slice(0, 16);
}
