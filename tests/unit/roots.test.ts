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

  it('rejects a root that escapes the project directory via ../', () => {
    // A sibling directory outside DIR with its own .env — simulates another real
    // project's secrets sitting next to this (untrusted/malicious) one.
    const siblingName = `devassets-roots-sibling-${path.basename(DIR)}`;
    const sibling = path.join(path.dirname(DIR), siblingName);
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, '.env'), 'SIBLING_SECRET=leaked\n');
    try {
      mk('.devassets.yml', `roots:\n  - ../${siblingName}\n`);
      const roots = resolveScanRoots(DIR);
      expect(roots.some(r => r.includes('..'))).toBe(false);
      expect(roots).toEqual(['.']); // falls back — nothing valid found within DIR itself
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true });
    }
  });

  it('rejects a root that is a symlink pointing outside the project directory', () => {
    // A lexically-contained path ("linked-sibling") that's actually a symlink escaping DIR — the
    // ../ check alone wouldn't catch this since the roots.yml entry itself contains no "..".
    const siblingName = `devassets-roots-symlink-target-${path.basename(DIR)}`;
    const sibling = path.join(path.dirname(DIR), siblingName);
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, '.env'), 'SIBLING_SECRET=leaked\n');
    const linkPath = path.join(DIR, 'linked-sibling');
    try {
      fs.symlinkSync(sibling, linkPath, 'dir');
      mk('.devassets.yml', 'roots:\n  - linked-sibling\n');
      const roots = resolveScanRoots(DIR);
      expect(roots).not.toContain('linked-sibling');
      expect(roots).toEqual(['.']);
    } finally {
      fs.rmSync(linkPath, { force: true });
      fs.rmSync(sibling, { recursive: true, force: true });
    }
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
