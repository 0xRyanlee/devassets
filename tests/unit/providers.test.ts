import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as supabase from '../../src/integrations/providers/supabase.js';
import * as gcloud from '../../src/integrations/providers/gcloud.js';
import * as vercel from '../../src/integrations/providers/vercel.js';
import * as npm from '../../src/integrations/providers/npm.js';
import * as apple from '../../src/integrations/providers/apple.js';
import { matchProvider } from '../../src/integrations/providers/index.js';

afterEach(() => vi.unstubAllGlobals());

describe('provider registry matching', () => {
  it('matches known token env names to providers', () => {
    expect(matchProvider('VERCEL_TOKEN')?.provider).toBe('vercel');
    expect(matchProvider('SUPABASE_ACCESS_TOKEN')?.provider).toBe('supabase');
    expect(matchProvider('NEXT_PUBLIC_SUPABASE_URL')?.provider).toBe('supabase');
    expect(matchProvider('NEON_API_KEY')?.provider).toBe('neon');
    expect(matchProvider('NPM_TOKEN')?.provider).toBe('npm');
    expect(matchProvider('GOOGLE_APPLICATION_CREDENTIALS')?.provider).toBe('gcloud');
  });

  it('returns undefined for non-provider keys', () => {
    expect(matchProvider('DATABASE_URL')).toBeUndefined();
    expect(matchProvider('APP_NAME')).toBeUndefined();
  });
});

describe('supabase.resolveUrl (offline)', () => {
  it('extracts project ref from URL', async () => {
    const r = await supabase.resolveUrl('https://abcd1234.supabase.co');
    expect(r.valid).toBe(true);
    expect(r.workspace).toBe('abcd1234');
    expect(r.projects).toEqual(['abcd1234']);
  });

  it('fails on malformed URL', async () => {
    const r = await supabase.resolveUrl('not-a-url');
    expect(r.valid).toBe(false);
  });
});

describe('gcloud.resolve (offline)', () => {
  it('parses raw service account JSON', async () => {
    const json = JSON.stringify({ client_email: 'sa@proj.iam.gserviceaccount.com', project_id: 'my-proj' });
    const r = await gcloud.resolve(json);
    expect(r.valid).toBe(true);
    expect(r.account).toBe('sa@proj.iam.gserviceaccount.com');
    expect(r.workspace).toBe('my-proj');
  });

  it('parses base64-encoded JSON', async () => {
    const json = JSON.stringify({ client_email: 'x@y.iam', project_id: 'p2' });
    const b64 = Buffer.from(json).toString('base64');
    const r = await gcloud.resolve(b64);
    expect(r.valid).toBe(true);
    expect(r.workspace).toBe('p2');
  });

  it('fails on garbage', async () => {
    const r = await gcloud.resolve('@@@not-json@@@');
    expect(r.valid).toBe(false);
  });

  it('reads a credential file path that falls inside the project directory', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-gcloud-'));
    const credPath = path.join(projectPath, 'service-account.json');
    fs.writeFileSync(credPath, JSON.stringify({ client_email: 'sa@proj.iam.gserviceaccount.com', project_id: 'inside-proj' }));
    try {
      const r = await gcloud.resolve(credPath, { projectPath });
      expect(r.valid).toBe(true);
      expect(r.workspace).toBe('inside-proj');
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it('refuses a credential file path outside the project directory', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-gcloud-project-'));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-gcloud-outside-'));
    const credPath = path.join(outsideDir, 'real-service-account.json');
    fs.writeFileSync(credPath, JSON.stringify({ client_email: 'real@victim.iam.gserviceaccount.com', project_id: 'victim-proj' }));
    try {
      const r = await gcloud.resolve(credPath, { projectPath });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('outside the project directory');
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('refuses a file path when no project context is given', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-gcloud-nocontext-'));
    const credPath = path.join(dir, 'service-account.json');
    fs.writeFileSync(credPath, JSON.stringify({ client_email: 'x@y.iam', project_id: 'p' }));
    try {
      const r = await gcloud.resolve(credPath);
      expect(r.valid).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses a credential path that is lexically inside the project but a symlink pointing outside', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-gcloud-symlink-proj-'));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-gcloud-symlink-outside-'));
    const realCredPath = path.join(outsideDir, 'real-service-account.json');
    fs.writeFileSync(realCredPath, JSON.stringify({ client_email: 'real@victim.iam.gserviceaccount.com', project_id: 'victim-proj' }));
    const linkPath = path.join(projectPath, 'service-account.json');
    fs.symlinkSync(realCredPath, linkPath);
    try {
      const r = await gcloud.resolve(linkPath, { projectPath });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('outside the project directory');
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('resolves a relative credential path against the project path, not process.cwd()', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-gcloud-relative-'));
    fs.writeFileSync(path.join(projectPath, 'service-account.json'), JSON.stringify({ client_email: 'sa@proj.iam.gserviceaccount.com', project_id: 'relative-proj' }));
    try {
      const r = await gcloud.resolve('service-account.json', { projectPath });
      expect(r.valid).toBe(true);
      expect(r.workspace).toBe('relative-proj');
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  });
});

describe('vercel.resolve (mocked)', () => {
  it('resolves account and teams', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { username: 'ryan', email: 'ryan@x.com' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ teams: [{ slug: 'hyphen' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const r = await vercel.resolve('tok');
    expect(r.valid).toBe(true);
    expect(r.account).toBe('ryan@x.com');
    expect(r.workspace).toBe('hyphen');
  });

  it('reports invalid token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const r = await vercel.resolve('bad');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('403');
  });
});

describe('npm.resolve (mocked)', () => {
  it('resolves username', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ username: 'ryan910814' }) }));
    const r = await npm.resolve('tok');
    expect(r.valid).toBe(true);
    expect(r.account).toBe('ryan910814');
  });
});

describe('apple.resolveKeyId (offline)', () => {
  it('accepts valid 10-char uppercase alphanumeric key ID', async () => {
    const r = await apple.resolveKeyId('ABCD1234EF');
    expect(r.valid).toBe(true);
    expect(r.account).toBe('ABCD1234EF');
  });

  it('rejects lowercase', async () => {
    const r = await apple.resolveKeyId('abcd1234ef');
    expect(r.valid).toBe(false);
  });

  it('rejects wrong length', async () => {
    const r = await apple.resolveKeyId('ABCD123');
    expect(r.valid).toBe(false);
  });

  it('trims surrounding whitespace', async () => {
    const r = await apple.resolveKeyId('  ABCD1234EF  ');
    expect(r.valid).toBe(true);
    expect(r.account).toBe('ABCD1234EF');
  });
});

describe('apple.resolveIssuerId (offline)', () => {
  it('accepts valid UUID', async () => {
    const r = await apple.resolveIssuerId('12345678-1234-1234-1234-1234567890ab');
    expect(r.valid).toBe(true);
  });

  it('rejects non-UUID string', async () => {
    const r = await apple.resolveIssuerId('not-a-uuid');
    expect(r.valid).toBe(false);
  });

  it('rejects UUID with wrong segment lengths', async () => {
    const r = await apple.resolveIssuerId('1234-1234-1234-1234-1234');
    expect(r.valid).toBe(false);
  });
});

describe('apple.resolveTeamId (offline)', () => {
  it('accepts valid 10-char team ID', async () => {
    const r = await apple.resolveTeamId('TEAM123456');
    expect(r.valid).toBe(true);
    expect(r.workspace).toBe('TEAM123456');
  });

  it('rejects team ID with special characters', async () => {
    const r = await apple.resolveTeamId('TEAM_12345');
    expect(r.valid).toBe(false);
  });
});

describe('apple.resolveP8Key (offline, no env vars)', () => {
  const fakePem = [
    '-----BEGIN PRIVATE KEY-----',
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hD2',
    '-----END PRIVATE KEY-----',
  ].join('\n');

  beforeEach(() => {
    delete process.env.APPLE_KEY_ID;
    delete process.env.APPLE_ISSUER_ID;
  });

  it('accepts PEM without env vars (format-only pass)', async () => {
    const r = await apple.resolveP8Key(fakePem);
    expect(r.valid).toBe(true);
  });

  it('accepts base64-encoded PEM', async () => {
    const b64 = Buffer.from(fakePem).toString('base64');
    const r = await apple.resolveP8Key(b64);
    expect(r.valid).toBe(true);
  });

  it('rejects garbage value', async () => {
    const r = await apple.resolveP8Key('not-a-pem-at-all-12345');
    expect(r.valid).toBe(false);
  });
});

describe('apple.resolveP8Key (mocked API)', () => {
  const fakePem = [
    '-----BEGIN PRIVATE KEY-----',
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hD2',
    '-----END PRIVATE KEY-----',
  ].join('\n');

  beforeEach(() => {
    process.env.APPLE_KEY_ID = 'ABCD1234EF';
    process.env.APPLE_ISSUER_ID = '12345678-1234-1234-1234-1234567890ab';
    process.env.APPLE_TEAM_ID = 'TEAM123456';
  });

  afterEach(() => {
    delete process.env.APPLE_KEY_ID;
    delete process.env.APPLE_ISSUER_ID;
    delete process.env.APPLE_TEAM_ID;
  });

  it('returns valid with account+workspace on API success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));
    // Need a real signable key — skip crypto sign, just verify it reaches the API path
    // Use a real P-256 key generated inline
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const r = await apple.resolveP8Key(pem);
    expect(r.valid).toBe(true);
    expect(r.account).toBe('ABCD1234EF');
    expect(r.workspace).toBe('TEAM123456');
  });

  it('returns invalid on API 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const r = await apple.resolveP8Key(pem);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('401');
  });
});

describe('provider registry — apple keys', () => {
  it('matches APPLE_KEY_ID to apple provider', () => {
    expect(matchProvider('APPLE_KEY_ID')?.provider).toBe('apple');
  });

  it('matches APPLE_ISSUER_ID to apple provider', () => {
    expect(matchProvider('APPLE_ISSUER_ID')?.provider).toBe('apple');
  });

  it('matches APPLE_TEAM_ID to apple provider', () => {
    expect(matchProvider('APPLE_TEAM_ID')?.provider).toBe('apple');
  });

  it('matches APPLE_API_KEY to apple provider', () => {
    expect(matchProvider('APPLE_API_KEY')?.provider).toBe('apple');
  });

  it('matches APPLE_PRIVATE_KEY_P8 to apple provider', () => {
    expect(matchProvider('APPLE_PRIVATE_KEY_P8')?.provider).toBe('apple');
  });

  it('matches APPLE_NOTARY_KEY to apple provider', () => {
    expect(matchProvider('APPLE_NOTARY_KEY')?.provider).toBe('apple');
  });
});
