import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { summarizeGithubSource, writePortfolioRun } from '../../src/core/portfolio.js';
import { slugify } from '../../src/utils/slug.js';
import type { PortfolioReport } from '../../src/types/portfolio.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('portfolio artifacts', () => {
  it('creates command-safe project ids', () => {
    expect(slugify('_legacy_computertw')).toBe('legacy-computertw');
    expect(slugify('---')).toBe('project');
  });

  it('keeps immutable history while atomically updating current', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devassets-overview-'));
    tempDirs.push(root);
    const report = sampleReport();
    const artifacts = writePortfolioRun(report, root);

    expect(JSON.parse(fs.readFileSync(artifacts.current, 'utf-8')).runId).toBe(report.runId);
    expect(JSON.parse(fs.readFileSync(artifacts.history, 'utf-8')).runId).toBe(report.runId);
    expect(fs.readFileSync(artifacts.log, 'utf-8')).toContain('Immutable snapshot');
    expect(fs.readFileSync(artifacts.journal, 'utf-8')).toContain(report.runId);
    expect(() => writePortfolioRun(report, root)).toThrow(/already exists/);
  });

  it('reports mixed GitHub evidence instead of claiming the whole run was live', () => {
    const unavailable = { available: false, openIssues: 0, openPullRequests: 0, ci: 'unavailable' } as const;
    const live = { ...unavailable, available: true, source: 'live' } as const;
    const snapshot = { ...unavailable, available: true, source: 'snapshot' } as const;

    expect(summarizeGithubSource([unavailable])).toBe('unavailable');
    expect(summarizeGithubSource([live])).toBe('live');
    expect(summarizeGithubSource([snapshot])).toBe('snapshot');
    expect(summarizeGithubSource([live, snapshot])).toBe('mixed');
  });
});

function sampleReport(): PortfolioReport {
  return {
    schemaVersion: 1,
    runId: '2026-06-09T00-00-00-000Z',
    generatedAt: '2026-06-09T00:00:00.000Z',
    generatedAtLocal: '2026-06-09 08:00:00',
    root: '/Volumes/Astoria/Projects',
    summary: {
      total: 1,
      active: 1,
      healthy: 1,
      attention: 0,
      archived: 0,
      gitRepos: 1,
      dirtyRepos: 0,
      unpushedRepos: 0,
      githubRepos: 1,
      ciSuccess: 1,
      assetWarnings: 0,
    },
    verification: {
      devassetsVersion: '0.7.0',
      scanSucceeded: 1,
      scanFailed: 0,
      githubSource: 'live',
      githubCapturedAt: '2026-06-09T00:00:00.000Z',
      notes: ['No values stored.'],
    },
    projects: [],
  };
}
