import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { signContent, verifySignature, encryptAES, decryptAES } from '../../src/utils/crypto.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_KEY_DIR = path.join(os.tmpdir(), '.devassets-test');
const TEST_KEY_PATH = path.join(TEST_KEY_DIR, 'signature.key');

beforeAll(() => {
  process.env.HOME = os.tmpdir();
  fs.mkdirSync(TEST_KEY_DIR, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(TEST_KEY_PATH)) fs.unlinkSync(TEST_KEY_PATH);
});

describe('signContent / verifySignature', () => {
  it('signs and verifies content', () => {
    const content = 'test manifest content';
    const timestamp = new Date().toISOString();
    const signature = signContent(content, timestamp);
    expect(verifySignature(content, timestamp, signature)).toBe(true);
  });

  it('rejects tampered content', () => {
    const timestamp = new Date().toISOString();
    const signature = signContent('original', timestamp);
    expect(verifySignature('tampered', timestamp, signature)).toBe(false);
  });

  it('rejects tampered timestamp', () => {
    const timestamp = new Date().toISOString();
    const signature = signContent('content', timestamp);
    expect(verifySignature('content', '2000-01-01T00:00:00Z', signature)).toBe(false);
  });
});

describe('encryptAES / decryptAES', () => {
  it('encrypts and decrypts correctly', () => {
    const plaintext = 'secret manifest data';
    const password = 'test-password-123';
    const encrypted = encryptAES(plaintext, password);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decryptAES(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it('fails with wrong password', () => {
    const encrypted = encryptAES('secret', 'correct-password');
    expect(() => decryptAES(encrypted, 'wrong-password')).toThrow();
  });

  it('produces different ciphertext each call', () => {
    const a = encryptAES('same content', 'same-password');
    const b = encryptAES('same content', 'same-password');
    expect(a).not.toBe(b);
  });
});
