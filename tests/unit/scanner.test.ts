import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanProject, scanSourceHardcoded } from '../../src/core/scanner.js';
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

describe('scanSourceHardcoded — hardcoded secret detection', () => {
  const SRC_PROJECT = path.join(os.tmpdir(), 'devassets-test-source-scan');

  beforeAll(() => {
    fs.mkdirSync(path.join(SRC_PROJECT, 'src'), { recursive: true });

    // Stripe live key — must be detected
    fs.writeFileSync(path.join(SRC_PROJECT, 'src', 'config.ts'), [
      'export const stripe = require("stripe");',
      'const STRIPE_KEY = "sk_live_abcdefghijklmnopqrstuvwx";',
      'module.exports = { stripe };',
    ].join('\n'));

    // AWS access key — must be detected
    fs.writeFileSync(path.join(SRC_PROJECT, 'src', 'aws.js'), [
      'const accessKeyId = "AKIAIOSFODNN7EXAMPLE";',
      'const region = "us-east-1";',
    ].join('\n'));

    // Assignment pattern — must be detected
    fs.writeFileSync(path.join(SRC_PROJECT, 'src', 'auth.py'), [
      'client_secret = "realClientSecret123456789"',
      'redirect_uri = "http://localhost:3000/callback"',
    ].join('\n'));

    // Placeholder — must NOT be detected
    fs.writeFileSync(path.join(SRC_PROJECT, 'src', 'example.ts'), [
      'const API_KEY = "your_api_key_here_replace_me";',
      'const SECRET = "<replace-with-your-secret>";',
    ].join('\n'));

    // .devassetsignore — suppresses aws.js
    fs.writeFileSync(path.join(SRC_PROJECT, '.devassetsignore'), 'src/aws.js\n');
  });

  afterAll(() => fs.rmSync(SRC_PROJECT, { recursive: true, force: true }));

  it('detects Stripe live key in source file', () => {
    const findings = scanSourceHardcoded(SRC_PROJECT);
    expect(findings.some(f => f.pattern === 'stripe' && f.file.includes('config.ts'))).toBe(true);
  });

  it('masks the detected value (does not expose full key)', () => {
    const findings = scanSourceHardcoded(SRC_PROJECT);
    const stripe = findings.find(f => f.pattern === 'stripe');
    expect(stripe?.match).toBe('sk_liv****');
    expect(stripe?.match).not.toContain('abcdefghijklmnopqrstuvwx');
  });

  it('detects assignment pattern in Python file', () => {
    const findings = scanSourceHardcoded(SRC_PROJECT);
    expect(findings.some(f => f.pattern === 'assignment' && f.file.includes('auth.py'))).toBe(true);
  });

  it('respects .devassetsignore — suppresses aws.js', () => {
    const findings = scanSourceHardcoded(SRC_PROJECT);
    expect(findings.some(f => f.file.includes('aws.js'))).toBe(false);
  });

  it('ignores placeholder values', () => {
    const findings = scanSourceHardcoded(SRC_PROJECT);
    expect(findings.some(f => f.file.includes('example.ts'))).toBe(false);
  });

  it('scanProject includes hardcodedFindings in result', () => {
    // Need a .env to satisfy scanner path check
    fs.writeFileSync(path.join(SRC_PROJECT, '.env'), 'APP=test\n');
    const result = scanProject('src-proj', SRC_PROJECT);
    expect(Array.isArray(result.hardcodedFindings)).toBe(true);
    expect(result.hardcodedFindings.some(f => f.pattern === 'stripe')).toBe(true);
  });

  it('skips files larger than the size guard instead of scanning them', () => {
    const bigFile = path.join(SRC_PROJECT, 'src', 'bundle.js');
    const padding = 'x'.repeat(520 * 1024);
    fs.writeFileSync(bigFile, `${padding}\nconst api_key = "shouldNotBeFoundInsideThisBigFile1234";\n`);
    try {
      const findings = scanSourceHardcoded(SRC_PROJECT);
      expect(findings.some(f => f.file.includes('bundle.js'))).toBe(false);
    } finally {
      fs.rmSync(bigFile);
    }
  });

  it('stops descending past the depth guard on a pathologically deep tree', () => {
    let deep = path.join(SRC_PROJECT, 'deep');
    for (let i = 0; i < 20; i++) deep = path.join(deep, `d${i}`);
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, 'leaf.ts'), 'const api_key = "tooDeepInTheTreeToEverBeFound1234";');
    try {
      expect(() => scanSourceHardcoded(SRC_PROJECT)).not.toThrow();
      const findings = scanSourceHardcoded(SRC_PROJECT);
      expect(findings.some(f => f.file.includes('leaf.ts'))).toBe(false);
    } finally {
      fs.rmSync(path.join(SRC_PROJECT, 'deep'), { recursive: true, force: true });
    }
  });
});
