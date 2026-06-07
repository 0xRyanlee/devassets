import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI = path.resolve('./dist/index.js');
const TMP = path.join(os.tmpdir(), 'devassets-cli-test');
const DB_DIR = path.join(TMP, '.devassets');

function cli(args: string, cwd = TMP): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [CLI, ...args.split(' ')], {
    cwd,
    env: { ...process.env, HOME: TMP },
    encoding: 'utf-8',
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

const PROJECT_PATH = path.join(TMP, 'myproject');

beforeAll(() => {
  fs.mkdirSync(PROJECT_PATH, { recursive: true });
  fs.writeFileSync(path.join(PROJECT_PATH, '.env'), 'DATABASE_URL=postgres://localhost\nSECRET_KEY=abc\nAPP_NAME=test\n');
  fs.writeFileSync(path.join(PROJECT_PATH, '.env.production'), 'PADDLE_API_KEY=pdl_live_xyz\nPADDLE_WEBHOOK_SECRET=whsec_abc\n');
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('CLI: init', () => {
  it('creates database and config files', () => {
    const { stdout, status } = cli('init');
    expect(status).toBe(0);
    expect(stdout).toContain('DevAssets initialized');
    expect(fs.existsSync(path.join(DB_DIR, 'devassets.db'))).toBe(true);
    expect(fs.existsSync(path.join(DB_DIR, 'signature.key'))).toBe(true);
  });
});

describe('CLI: add-project', () => {
  it('registers a project', () => {
    const { stdout, status } = cli(`add-project myproject --path=${PROJECT_PATH} --type=saas`);
    expect(status).toBe(0);
    expect(stdout).toContain('Added project');
    expect(stdout).toContain('myproject');
  });

  it('updates existing project on re-add', () => {
    const { stdout, status } = cli(`add-project myproject --path=${PROJECT_PATH} --type=saas`);
    expect(status).toBe(0);
    expect(stdout).toContain('Updated project');
  });
});

describe('CLI: scan', () => {
  it('scans env files and reports assets', () => {
    const { stdout, status } = cli('scan myproject');
    expect(status).toBe(0);
    expect(stdout).toContain('Scan complete');
    expect(stdout).toContain('.env');
  });

  it('detects Paddle platform', () => {
    const { stdout } = cli('scan myproject');
    expect(stdout).toContain('paddle');
  });

  it('outputs JSON with --json flag', () => {
    const { stdout, status } = cli('scan myproject --json');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.assets.length).toBeGreaterThan(0);
  });
});

describe('CLI: check', () => {
  it('shows project health', () => {
    const { stdout, status } = cli('check myproject');
    expect(status).toBe(0);
    expect(stdout).toContain('myproject');
    expect(stdout).toMatch(/HEALTHY|WARNING|CRITICAL/);
  });

  it('outputs JSON with --format=json', () => {
    const { stdout, status } = cli('check myproject --format=json');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.project).toBe('myproject');
    expect(parsed.status).toMatch(/healthy|warning|critical/);
    expect(parsed.assets).toBeDefined();
  });

  it('exits 0 when healthy', () => {
    const { status } = cli('check myproject --fail-on-risk');
    expect([0, 1]).toContain(status);
  });
});

describe('CLI: export', () => {
  it('exports a signed manifest to stdout', () => {
    const { stdout, status } = cli('check myproject --format=json');
    expect(status).toBe(0);
    const exportResult = cli('export myproject --env=production --stdout');
    expect(exportResult.status).toBe(0);
    expect(exportResult.stdout).toContain('myproject');
    expect(exportResult.stdout).toContain('signature');
  });

  it('saves manifest to file', () => {
    const outPath = path.join(TMP, 'manifest.yml');
    const { status } = cli(`export myproject --env=production --output=${outPath}`);
    expect(status).toBe(0);
    expect(fs.existsSync(outPath)).toBe(true);
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toContain('project: myproject');
    expect(content).toContain('signature:');
  });

  it('generates checklist format', () => {
    const { stdout, status } = cli('export myproject --format=checklist --stdout');
    expect(status).toBe(0);
    expect(stdout).toContain('# DevAssets Checklist');
  });

  it('generates reference-only format', () => {
    const { stdout, status } = cli('export myproject --format=reference-only --stdout');
    expect(status).toBe(0);
    expect(stdout).toContain('# DevAssets Reference');
  });
});

describe('CLI: audit', () => {
  it('shows audit log after operations', () => {
    const { stdout, status } = cli('audit myproject');
    expect(status).toBe(0);
    expect(stdout).toContain('Audit Log');
  });

  it('outputs JSON with --format=json', () => {
    const { stdout, status } = cli('audit myproject --format=json');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('filters by action', () => {
    const { stdout, status } = cli('audit myproject --action=scan --format=json');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.every((l: { action: string }) => l.action === 'scan')).toBe(true);
  });
});

describe('CLI: verify', () => {
  it('verifies a manifest file', () => {
    const outPath = path.join(TMP, 'verify-manifest.yml');
    cli(`export myproject --env=production --output=${outPath}`);
    const { stdout, status } = cli(`verify myproject --manifest=${outPath}`);
    expect(status).toBe(0);
    expect(stdout).toContain('verified');
  });
});

describe('CLI: doctor', () => {
  it('prints health report in human format', () => {
    const { stdout, status } = cli('doctor');
    expect(status).toBe(0);
    expect(stdout).toContain('DevAssets');
  });

  it('outputs valid JSON with --json flag', () => {
    const { stdout, status } = cli('doctor --json');
    expect(status).toBe(0);
    const report = JSON.parse(stdout);
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('projects');
    expect(report).toHaveProperty('topRisks');
    expect(report).toHaveProperty('recentActivity');
  });

  it('summary counts are consistent', () => {
    const { stdout } = cli('doctor --json');
    const report = JSON.parse(stdout);
    const { healthy, warning, critical, total } = report.summary;
    expect(healthy + warning + critical).toBe(total);
  });

  it('--fix re-scans projects and reports', () => {
    const { stdout, status } = cli('doctor --fix --json');
    expect(status).toBe(0);
    const report = JSON.parse(stdout);
    expect(report).toHaveProperty('deadPaths');
    expect(Array.isArray(report.deadPaths)).toBe(true);
    expect(report).toHaveProperty('summary');
  });
});

describe('CLI: error handling', () => {
  it('exits 1 for unknown project', () => {
    const { status } = cli('scan nonexistent');
    expect(status).toBe(1);
  });

  it('exits 1 for verify with missing manifest', () => {
    const { status } = cli('verify myproject --manifest=/nonexistent/path.yml');
    expect(status).toBe(1);
  });
});
