import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readEnvValue, scanEnvKeys, scanDeclaredKeys } from '../../src/utils/dotenv.js';

const DIR = path.join(os.tmpdir(), `devassets-dotenv-test-${Date.now()}`);

beforeAll(() => {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, '.env'), [
    'PLAIN=hello',
    'QUOTED="with spaces"',
    "SINGLE='single'",
    'EMPTY=',
    '# comment=ignored',
  ].join('\n'));
  fs.writeFileSync(path.join(DIR, '.env.example'), 'DECLARED_ONLY=\nPLAIN=\n');
});

afterAll(() => fs.rmSync(DIR, { recursive: true, force: true }));

describe('readEnvValue', () => {
  it('reads a plain value', () => {
    expect(readEnvValue(DIR, 'PLAIN')).toBe('hello');
  });

  it('strips double and single quotes', () => {
    expect(readEnvValue(DIR, 'QUOTED')).toBe('with spaces');
    expect(readEnvValue(DIR, 'SINGLE')).toBe('single');
  });

  it('returns empty string for an empty value', () => {
    expect(readEnvValue(DIR, 'EMPTY')).toBe('');
  });

  it('returns undefined for a missing key', () => {
    expect(readEnvValue(DIR, 'NOPE')).toBeUndefined();
  });

  it('does not read values from example files (names-only boundary)', () => {
    // DECLARED_ONLY exists only in .env.example, which is not an actual value source
    expect(readEnvValue(DIR, 'DECLARED_ONLY')).toBeUndefined();
  });
});

describe('scanEnvKeys / scanDeclaredKeys separation', () => {
  it('scanEnvKeys reads actual env, not example', () => {
    const names = scanEnvKeys(DIR).map(k => k.name);
    expect(names).toContain('PLAIN');
    expect(names).not.toContain('DECLARED_ONLY');
  });

  it('scanDeclaredKeys reads example declarations', () => {
    const names = scanDeclaredKeys(DIR).map(k => k.name);
    expect(names).toContain('DECLARED_ONLY');
  });
});
