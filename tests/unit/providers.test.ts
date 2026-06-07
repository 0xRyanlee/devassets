import { describe, it, expect, vi, afterEach } from 'vitest';
import * as supabase from '../../src/integrations/providers/supabase.js';
import * as gcloud from '../../src/integrations/providers/gcloud.js';
import * as vercel from '../../src/integrations/providers/vercel.js';
import * as npm from '../../src/integrations/providers/npm.js';
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
