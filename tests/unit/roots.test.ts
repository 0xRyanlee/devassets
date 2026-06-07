import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { resolveScanRoots } from '../../src/core/roots.js';

let DIR: string;

beforeEach(() => {
  DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-roots-'));
});
afterEach(() => fs.rmSync(DIR, { recursive: true, force: true }));

function mk(rel: string, content = '') {
  const full = path.join(DIR, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe('resolveScanRoots — layer 3 (smart discovery)', () => {
  it('finds subdirs with a manifest AND an env file', () => {
    mk('web/package.json', '{}');
    mk('web/.env.local', 'A=1');
    mk('api/package.json', '{}');
    mk('api/.env', 'B=2');
    const roots = resolveScanRoots(DIR).sort();
    expect(roots).toContain('web');
    expect(roots).toContain('api');
  });

  it('skips dirs without a manifest (fixtures/archives)', () => {
    mk('archive/old/.env', 'X=1');
    mk('web/package.json', '{}');
    mk('web/.env', 'A=1');
    const roots = resolveScanRoots(DIR);
    expect(roots).toContain('web');
    expect(roots).not.toContain('archive/old');
  });

  it('ignores node_modules', () => {
    mk('node_modules/pkg/package.json', '{}');
    mk('node_modules/pkg/.env', 'A=1');
    mk('app/package.json', '{}');
    mk('app/.env', 'B=2');
    const roots = resolveScanRoots(DIR);
    expect(roots).toEqual(['app']);
  });
});

describe('resolveScanRoots — layer 2 (workspace manifest)', () => {
  it('expands package.json workspaces globs', () => {
    mk('package.json', JSON.stringify({ workspaces: ['packages/*'] }));
    mk('packages/a/package.json', '{}');
    mk('packages/a/.env', 'A=1');
    mk('packages/b/package.json', '{}');
    mk('packages/b/.env.local', 'B=2');
    const roots = resolveScanRoots(DIR).sort();
    expect(roots).toContain('packages/a');
    expect(roots).toContain('packages/b');
  });
});

describe('resolveScanRoots — layer 1 (.devassets.yml override)', () => {
  it('explicit roots take priority', () => {
    mk('.devassets.yml', 'roots:\n  - frontend\n');
    mk('frontend/.env', 'A=1');
    mk('other/package.json', '{}');
    mk('other/.env', 'B=2');
    const roots = resolveScanRoots(DIR);
    expect(roots).toContain('frontend');
    expect(roots).not.toContain('other');
  });
});

describe('resolveScanRoots — fallback', () => {
  it('returns root when env at top level', () => {
    mk('.env', 'A=1');
    expect(resolveScanRoots(DIR)).toContain('.');
  });

  it('returns root when nothing found', () => {
    expect(resolveScanRoots(DIR)).toEqual(['.']);
  });
});
