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
