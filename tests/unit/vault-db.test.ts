import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

// vi.hoisted runs before imports — must use require() for os/path
const { TEST_HOME, TEST_DB, TEST_SIG_KEY } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _os = require('os') as typeof import('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _path = require('path') as typeof import('path');
  const home = _path.join(_os.tmpdir(), 'devassets-vault-db-test-' + process.pid);
  return { TEST_HOME: home, TEST_DB: _path.join(home, 'test.db'), TEST_SIG_KEY: _path.join(home, 'signature.key') };
});

vi.mock('../../src/utils/constants.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/utils/constants.js')>();
  return {
    ...orig,
    DEVASSETS_DIR: TEST_HOME,
    DB_PATH: TEST_DB,
    SIGNATURE_KEY_PATH: TEST_SIG_KEY,
  };
});

// Imports must come AFTER vi.mock (hoisted by vitest, but keep explicit ordering)
import { closeDb } from '../../src/db/index.js';
import {
  setVaultSecret,
  getVaultSecret,
  getVaultSecretWithMeta,
  listVaultSecrets,
  findSecretAcrossProjects,
  getVaultSecretFallback,
  getGlobalSecret,
  upsertProject,
} from '../../src/db/queries.js';
import { DEFAULT_ENV } from '../../src/utils/constants.js';

beforeAll(() => {
  fs.mkdirSync(TEST_HOME, { recursive: true });
  // Seed a test project so FK constraints are satisfied
  upsertProject({ id: 'proj-a', name: 'Project A', path: '/tmp/proj-a', type: 'saas' });
  upsertProject({ id: 'proj-b', name: 'Project B', path: '/tmp/proj-b', type: 'saas' });
});

afterAll(() => {
  closeDb();
  fs.rmSync(TEST_HOME, { recursive: true, force: true });
});

describe('setVaultSecret scope routing', () => {
  it('stores project-scoped secret under its own project', () => {
    setVaultSecret('proj-a', 'local', 'STRIPE_KEY', 'sk_test_abc', {}, 'project');
    const val = getVaultSecret('proj-a', 'local', 'STRIPE_KEY');
    expect(val).toBe('sk_test_abc');
  });

  it('stores global-scoped secret under _global regardless of projectId arg', () => {
    setVaultSecret('proj-a', 'production', 'VERCEL_TOKEN', 'token_global_xyz', {}, 'global');
    // Must be readable from _global project directly
    const val = getVaultSecret('_global', 'production', 'VERCEL_TOKEN');
    expect(val).toBe('token_global_xyz');
    // Must NOT be readable from proj-a directly (it was redirected to _global)
    const projVal = getVaultSecret('proj-a', 'production', 'VERCEL_TOKEN');
    expect(projVal).toBeUndefined();
  });

  it('scope column is set to global for _global-stored secret', () => {
    const secrets = listVaultSecrets('_global', 'production');
    const entry = secrets.find(s => s.key === 'VERCEL_TOKEN');
    expect(entry?.scope).toBe('global');
  });
});

describe('listVaultSecrets', () => {
  it('returns project-scoped secrets for a project', () => {
    const secrets = listVaultSecrets('proj-a', 'local');
    expect(secrets.some(s => s.key === 'STRIPE_KEY')).toBe(true);
  });

  it('scope="global" filter auto-redirects to _global project', () => {
    // Store a second global key via proj-b to ensure redirect works regardless of caller
    setVaultSecret('proj-b', 'production', 'ANTHROPIC_KEY', 'sk-ant-123', {}, 'global');
    // Query with scope='global' from proj-b — should return _global's secrets
    const secrets = listVaultSecrets('proj-b', 'production', 'global');
    expect(secrets.some(s => s.key === 'VERCEL_TOKEN')).toBe(true);
    expect(secrets.some(s => s.key === 'ANTHROPIC_KEY')).toBe(true);
    // All returned entries should have scope='global'
    expect(secrets.every(s => s.scope === 'global')).toBe(true);
  });

  it('no scope filter returns only that project secrets', () => {
    const secrets = listVaultSecrets('proj-a', 'local');
    // proj-a local secrets should not include global keys
    expect(secrets.every(s => s.scope !== 'global')).toBe(true);
  });
});

describe('findSecretAcrossProjects scope filter', () => {
  it('finds a key across all projects without scope filter', () => {
    const matches = findSecretAcrossProjects('VERCEL_TOKEN');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some(m => m.projectId === '_global')).toBe(true);
  });

  it('scope="global" filter returns only global-scoped entries', () => {
    setVaultSecret('proj-a', 'production', 'VERCEL_TOKEN', 'sk_proj_override', {}, 'project');
    const globalOnly = findSecretAcrossProjects('VERCEL_TOKEN', undefined, 'global');
    expect(globalOnly.every(m => m.scope === 'global')).toBe(true);
    expect(globalOnly.some(m => m.projectId === '_global')).toBe(true);
    // The project-scoped entry in proj-a should be excluded
    expect(globalOnly.some(m => m.projectId === 'proj-a')).toBe(false);
  });

  it('scope="project" filter returns only project-scoped entries', () => {
    const projOnly = findSecretAcrossProjects('VERCEL_TOKEN', undefined, 'project');
    expect(projOnly.every(m => m.scope === 'project')).toBe(true);
    expect(projOnly.some(m => m.projectId === 'proj-a')).toBe(true);
    expect(projOnly.some(m => m.projectId === '_global')).toBe(false);
  });
});

describe('getVaultSecretFallback priority order', () => {
  beforeAll(() => {
    // proj-b local: no FALLBACK_KEY → fallback should find _global then proj-a
    setVaultSecret('_global', 'local', 'FALLBACK_KEY', 'from_global', {}, 'global');
  });

  it('returns own project value first', () => {
    setVaultSecret('proj-a', 'local', 'PRIORITY_KEY', 'from_proj_a', {}, 'project');
    setVaultSecret('_global', 'local', 'PRIORITY_KEY', 'from_global', {}, 'global');
    const result = getVaultSecretFallback('proj-a', 'local', 'PRIORITY_KEY');
    expect(result?.value).toBe('from_proj_a');
    expect(result?.sourceProject).toBe('proj-a');
  });

  it('falls back to _global if not in primary project', () => {
    const result = getVaultSecretFallback('proj-b', 'local', 'FALLBACK_KEY');
    expect(result?.value).toBe('from_global');
    expect(result?.sourceProject).toBe('_global');
  });

  it('does NOT fall back to an unrelated project — only primary + _global are checked', () => {
    setVaultSecret('proj-a', 'local', 'ONLY_IN_A', 'val_a', {}, 'project');
    const result = getVaultSecretFallback('proj-b', 'local', 'ONLY_IN_A');
    expect(result).toBeUndefined();
  });

  it('returns undefined if key exists nowhere', () => {
    const result = getVaultSecretFallback('proj-b', 'local', 'NONEXISTENT_XXXX');
    expect(result).toBeUndefined();
  });
});

describe('getVaultSecretFallback scope from DB', () => {
  it('scope returned matches what was stored (global)', () => {
    const result = getVaultSecretFallback('proj-b', 'production', 'VERCEL_TOKEN');
    // Fallback should find _global entry with scope='global'
    expect(result?.scope).toBe('global');
    expect(result?.sourceProject).toBe('_global');
  });

  it('scope returned matches what was stored (project)', () => {
    const result = getVaultSecretFallback('proj-a', 'local', 'STRIPE_KEY');
    expect(result?.scope).toBe('project');
    expect(result?.sourceProject).toBe('proj-a');
  });
});

describe('getGlobalSecret', () => {
  it('retrieves a global secret by key and env', () => {
    const val = getGlobalSecret('VERCEL_TOKEN', 'production');
    expect(val).toBe('token_global_xyz');
  });

  it('returns undefined for unknown global key', () => {
    const val = getGlobalSecret('DEFINITELY_NOT_SET_XYZ', 'production');
    expect(val).toBeUndefined();
  });
});

describe('DEFAULT_ENV consistency — CLI/MCP env parity', () => {
  it('DEFAULT_ENV is local', () => {
    expect(DEFAULT_ENV).toBe('local');
  });

  it('set with DEFAULT_ENV then get with DEFAULT_ENV round-trips', () => {
    setVaultSecret('proj-a', DEFAULT_ENV, 'ENV_PARITY_KEY', 'parity_value', {}, 'project');
    const val = getVaultSecret('proj-a', DEFAULT_ENV, 'ENV_PARITY_KEY');
    expect(val).toBe('parity_value');
  });

  it('key stored in DEFAULT_ENV is NOT found when queried with production', () => {
    const val = getVaultSecret('proj-a', 'production', 'ENV_PARITY_KEY');
    expect(val).toBeUndefined();
  });

  it('findSecretAcrossProjects finds key stored in DEFAULT_ENV regardless of queried env', () => {
    const matches = findSecretAcrossProjects('ENV_PARITY_KEY');
    expect(matches.some(m => m.env === DEFAULT_ENV)).toBe(true);
  });
});

describe('file-type secret round-trip (encoding metadata)', () => {
  it('text secret defaults to utf8 encoding', () => {
    setVaultSecret('proj-a', 'local', 'TEXT_FILE_KEY', 'hello from text file', { encoding: 'utf8', filename: 'config.txt' }, 'project');
    const meta = getVaultSecretWithMeta('proj-a', 'local', 'TEXT_FILE_KEY');
    expect(meta).toBeDefined();
    expect(meta?.value).toBe('hello from text file');
    expect(meta?.encoding).toBe('utf8');
    expect(meta?.originalFilename).toBe('config.txt');
  });

  it('binary secret stored as base64 round-trips correctly', () => {
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xAB, 0xCD]);
    const b64 = binaryData.toString('base64');
    setVaultSecret('proj-a', 'local', 'BINARY_KEY', b64, { encoding: 'base64', filename: 'AuthKey.p8' }, 'project');
    const meta = getVaultSecretWithMeta('proj-a', 'local', 'BINARY_KEY');
    expect(meta?.encoding).toBe('base64');
    expect(meta?.originalFilename).toBe('AuthKey.p8');
    const recovered = Buffer.from(meta!.value, 'base64');
    expect(recovered.equals(binaryData)).toBe(true);
  });

  it('listVaultSecrets includes encoding and originalFilename fields', () => {
    const secrets = listVaultSecrets('proj-a', 'local');
    const binary = secrets.find(s => s.key === 'BINARY_KEY');
    expect(binary?.encoding).toBe('base64');
    expect(binary?.originalFilename).toBe('AuthKey.p8');
    const text = secrets.find(s => s.key === 'TEXT_FILE_KEY');
    expect(text?.encoding).toBe('utf8');
  });

  it('existing string secrets default to utf8 encoding with no filename', () => {
    const meta = getVaultSecretWithMeta('proj-a', 'local', 'STRIPE_KEY');
    expect(meta?.encoding).toBe('utf8');
    expect(meta?.originalFilename).toBeUndefined();
  });
});
