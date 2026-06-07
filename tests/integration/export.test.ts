import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exportManifest } from '../../src/core/exporter.js';
import { validateAssets } from '../../src/core/validator.js';
import { verifySignature } from '../../src/utils/crypto.js';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Asset } from '../../src/types/index.js';

const TMP_DIR = path.join(os.tmpdir(), 'devassets-export-test');

beforeAll(() => {
  process.env.HOME = os.tmpdir();
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const sampleAssets: Asset[] = [
  { projectId: 'legita', name: 'SUPABASE_URL', location: '.env:1', status: 'configured', lastSeen: new Date().toISOString() },
  { projectId: 'legita', name: 'SUPABASE_KEY', location: '.env:2', status: 'configured', lastSeen: new Date().toISOString() },
  { projectId: 'legita', name: 'PADDLE_WEBHOOK_SECRET', location: '.env.production:3', status: 'missing', lastSeen: new Date().toISOString(), environment: 'production' },
];

describe('exportManifest', () => {
  it('produces a signed manifest', () => {
    const checkResult = validateAssets(sampleAssets, 'legita', 'production');
    const result = exportManifest(checkResult, {
      project: 'legita', environment: 'production', format: 'manifest',
    });

    expect(result.signature).toBeTruthy();
    expect(result.content).toContain('legita');
    expect(result.encrypted).toBe(false);
  });

  it('manifest signature is valid', () => {
    const checkResult = validateAssets(sampleAssets, 'legita', 'production');
    const result = exportManifest(checkResult, {
      project: 'legita', environment: 'production', format: 'manifest',
    });

    const data = yaml.load(result.content) as Record<string, unknown>;
    const sig = data['signature'] as Record<string, string>;
    expect(sig).toBeTruthy();
    expect(sig['value']).toBe(result.signature);
  });

  it('does not include secret values', () => {
    const checkResult = validateAssets(sampleAssets, 'legita', 'production');
    const result = exportManifest(checkResult, {
      project: 'legita', environment: 'production', format: 'manifest',
    });

    expect(result.content).not.toMatch(/sk_live_/);
    expect(result.content).not.toMatch(/supersecret/);
    expect(result.content).toContain('SUPABASE_URL');
  });

  it('encrypts when requested', () => {
    const checkResult = validateAssets(sampleAssets, 'legita', 'production');
    const result = exportManifest(checkResult, {
      project: 'legita', environment: 'production', format: 'manifest',
      encrypt: true, encryptFor: 'test-password',
    });

    expect(result.encrypted).toBe(true);
    expect(result.content).not.toContain('legita');
  });

  it('saves to file when outputPath provided', () => {
    const outputPath = path.join(TMP_DIR, 'test-manifest.yml');
    const checkResult = validateAssets(sampleAssets, 'legita', 'production');
    exportManifest(checkResult, {
      project: 'legita', environment: 'production', format: 'manifest', outputPath,
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('legita');
  });

  it('recommends encryption for production', () => {
    const checkResult = validateAssets(sampleAssets, 'legita', 'production');
    const result = exportManifest(checkResult, {
      project: 'legita', environment: 'production', format: 'manifest',
    });

    expect(result.autoDecision.encryptionRecommended).toBe(true);
  });

  it('generates checklist format', () => {
    const checkResult = validateAssets(sampleAssets, 'legita');
    const result = exportManifest(checkResult, {
      project: 'legita', environment: 'production', format: 'checklist',
    });

    expect(result.content).toContain('# DevAssets Checklist');
    expect(result.content).toContain('- [x]');
  });
});
