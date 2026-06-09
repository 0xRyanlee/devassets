import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { encryptVault, decryptVault, getVaultKey } from '../../src/utils/crypto.js';

const TEST_HOME = path.join(os.tmpdir(), '.devassets-vault-test-' + process.pid);

beforeAll(() => {
  process.env.HOME = TEST_HOME;
  fs.mkdirSync(path.join(TEST_HOME, '.config', 'devassets'), { recursive: true });
});

afterAll(() => {
  fs.rmSync(TEST_HOME, { recursive: true, force: true });
});

describe('vault key derivation', () => {
  it('returns 32-byte key', () => {
    const key = getVaultKey();
    expect(key.length).toBe(32);
  });

  it('is deterministic for same sig key', () => {
    const a = getVaultKey();
    const b = getVaultKey();
    expect(a.equals(b)).toBe(true);
  });
});

describe('encryptVault / decryptVault', () => {
  it('round-trips plaintext', () => {
    const plain = 'sk_live_super_secret_key_12345';
    const { ciphertext, iv, authTag } = encryptVault(plain);
    const recovered = decryptVault(ciphertext, iv, authTag);
    expect(recovered).toBe(plain);
  });

  it('produces unique IV each call', () => {
    const { iv: iv1 } = encryptVault('same');
    const { iv: iv2 } = encryptVault('same');
    expect(iv1).not.toBe(iv2);
  });

  it('ciphertext differs for same input', () => {
    const { ciphertext: c1 } = encryptVault('x');
    const { ciphertext: c2 } = encryptVault('x');
    expect(c1).not.toBe(c2);
  });

  it('throws on auth tag tamper', () => {
    const { ciphertext, iv } = encryptVault('value');
    expect(() => decryptVault(ciphertext, iv, 'deadbeefdeadbeefdeadbeefdeadbeef')).toThrow();
  });

  it('throws on ciphertext tamper', () => {
    const { ciphertext, iv, authTag } = encryptVault('value');
    const tampered = ciphertext.slice(0, -2) + 'ff';
    expect(() => decryptVault(tampered, iv, authTag)).toThrow();
  });

  it('handles unicode and empty string', () => {
    for (const input of ['', '你好世界 🚀', 'key=val&foo=bar']) {
      const { ciphertext, iv, authTag } = encryptVault(input);
      expect(decryptVault(ciphertext, iv, authTag)).toBe(input);
    }
  });
});
