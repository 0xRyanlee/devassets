import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanProject } from '../../src/core/scanner.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TMP_PROJECT = path.join(os.tmpdir(), 'devassets-test-project');

beforeAll(() => {
  fs.mkdirSync(TMP_PROJECT, { recursive: true });
  fs.writeFileSync(path.join(TMP_PROJECT, '.env'), `
DATABASE_URL=postgres://localhost/test
SECRET_KEY=supersecret
APP_NAME=TestApp
`.trim());
  fs.writeFileSync(path.join(TMP_PROJECT, '.env.production'), `
DATABASE_URL=postgres://prod/test
PADDLE_API_KEY=pdl_live_abc
PADDLE_WEBHOOK_SECRET=whsec_xyz
`.trim());
});

afterAll(() => {
  fs.rmSync(TMP_PROJECT, { recursive: true, force: true });
});

describe('scanProject', () => {
  it('scans env files and returns assets', () => {
    const result = scanProject('test-project', TMP_PROJECT);
    expect(result.assets.length).toBeGreaterThan(0);
    expect(result.envFilesFound).toContain('.env');
    expect(result.envFilesFound).toContain('.env.production');
  });

  it('detects Paddle platform', () => {
    const result = scanProject('test-project', TMP_PROJECT);
    expect(result.detectedPlatforms).toContain('paddle');
  });

  it('does not read secret values', () => {
    const result = scanProject('test-project', TMP_PROJECT);
    const assetNames = result.assets.map(a => a.name);
    expect(assetNames).toContain('DATABASE_URL');
    expect(assetNames).toContain('PADDLE_API_KEY');
    // assets should only have names, not values
    const assetValues = result.assets.map(a => JSON.stringify(a));
    for (const v of assetValues) {
      expect(v).not.toContain('supersecret');
      expect(v).not.toContain('pdl_live_abc');
      expect(v).not.toContain('whsec_xyz');
    }
  });

  it('infers production environment from filename', () => {
    const result = scanProject('test-project', TMP_PROJECT);
    const prodAsset = result.assets.find(a => a.name === 'PADDLE_API_KEY');
    expect(prodAsset?.environment).toBe('production');
  });

  it('throws for non-existent path', () => {
    expect(() => scanProject('x', '/nonexistent/path')).toThrow();
  });
});

describe('scanProject — example/required key detection', () => {
  const EX_PROJECT = path.join(os.tmpdir(), 'devassets-test-example');

  beforeAll(() => {
    fs.mkdirSync(EX_PROJECT, { recursive: true });
    fs.writeFileSync(path.join(EX_PROJECT, '.env'), 'DATABASE_URL=x\nAPP_NAME=app\n');
    fs.writeFileSync(path.join(EX_PROJECT, '.env.example'), [
      'DATABASE_URL=',
      'APP_NAME=',
      'STRIPE_SECRET_KEY=',
      'AUTH_TOKEN_KEY=',
      'API_TIMEOUT=',
      'FEATURE_FLAG=',
    ].join('\n'));
  });

  afterAll(() => fs.rmSync(EX_PROJECT, { recursive: true, force: true }));

  it('marks declared-but-absent keys as missing', () => {
    const result = scanProject('ex', EX_PROJECT);
    const missing = result.assets.filter(a => a.status === 'missing').map(a => a.name);
    expect(missing).toContain('STRIPE_SECRET_KEY');
    expect(missing).toContain('AUTH_TOKEN_KEY');
    expect(missing).toContain('API_TIMEOUT');
    expect(missing).toContain('FEATURE_FLAG');
    expect(missing).not.toContain('DATABASE_URL');
    expect(missing).not.toContain('APP_NAME');
  });

  it('does not treat example file as a configured source', () => {
    const result = scanProject('ex', EX_PROJECT);
    const configured = result.assets.filter(a => a.status === 'configured').map(a => a.name);
    expect(configured).toEqual(expect.arrayContaining(['DATABASE_URL', 'APP_NAME']));
    expect(configured).not.toContain('STRIPE_SECRET_KEY');
  });
});

describe('scanProject — .devassets.yml managed locations (Axis B)', () => {
  const MG = path.join(os.tmpdir(), 'devassets-test-managed');

  beforeAll(() => {
    fs.mkdirSync(MG, { recursive: true });
    fs.writeFileSync(path.join(MG, '.env'), 'DATABASE_URL=x\n');
    fs.writeFileSync(path.join(MG, '.env.example'), 'DATABASE_URL=\nVERCEL_TOKEN=\nSTRIPE_SECRET_KEY=\n');
    fs.writeFileSync(path.join(MG, '.devassets.yml'), [
      'secrets:',
      '  VERCEL_TOKEN: cloud-platform',
      '  GITHUB_TOKEN: ci-secret',
      '  STRIPE_SECRET_KEY: local-env',
    ].join('\n'));
  });

  afterAll(() => fs.rmSync(MG, { recursive: true, force: true }));

  it('declared cloud/ci keys absent locally become managed, not missing', () => {
    const result = scanProject('mg', MG);
    const vercel = result.assets.find(a => a.name === 'VERCEL_TOKEN');
    expect(vercel?.status).toBe('managed');
    expect(vercel?.location).toBe('cloud-platform');
  });

  it('managed key declared only in .devassets.yml (no file) still surfaces', () => {
    const result = scanProject('mg', MG);
    const gh = result.assets.find(a => a.name === 'GITHUB_TOKEN');
    expect(gh?.status).toBe('managed');
    expect(gh?.location).toBe('ci-secret');
  });

  it('local-env declared key stays missing when absent', () => {
    const result = scanProject('mg', MG);
    const stripe = result.assets.find(a => a.name === 'STRIPE_SECRET_KEY');
    expect(stripe?.status).toBe('missing');
  });
});
