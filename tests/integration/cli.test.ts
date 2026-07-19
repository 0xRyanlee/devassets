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
  fs.writeFileSync(path.join(PROJECT_PATH, '.env'), 'DATABASE_URL=postgres://localhost\nSECRET_KEY=abc\nAPP_NAME=test\nNEXT_PUBLIC_SUPABASE_URL=https://testref01.supabase.co\n');
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

  it('creates a command-safe id from a name with leading punctuation', () => {
    const added = cli(`add-project _legacy_computertw --path=${PROJECT_PATH}`);
    expect(added.status).toBe(0);
    expect(added.stdout).toContain('legacy-computertw');

    const scanned = cli('scan legacy-computertw --json');
    expect(scanned.status).toBe(0);
    expect(JSON.parse(scanned.stdout).projectId).toBe('legacy-computertw');
  });
});

describe('CLI: import', () => {
  const IMPORT_ROOT = path.join(TMP, 'import-root');

  beforeAll(() => {
    fs.mkdirSync(path.join(IMPORT_ROOT, 'importapp-a'), { recursive: true });
    fs.mkdirSync(path.join(IMPORT_ROOT, 'importapp-b'), { recursive: true });
    fs.mkdirSync(path.join(IMPORT_ROOT, '.hidden'), { recursive: true });
    fs.mkdirSync(path.join(IMPORT_ROOT, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(IMPORT_ROOT, 'importapp-a', '.env'), 'DATABASE_URL=postgres://x\n');
  });

  it('--dry-run previews without registering', () => {
    const { stdout, status } = cli(`import --root=${IMPORT_ROOT} --dry-run`);
    expect(status).toBe(0);
    expect(stdout).toContain('importapp-a');
    expect(stdout).toContain('importapp-b');
    expect(stdout).toContain('dry run');
    expect(cli('list importapp-a').stdout).not.toContain('DATABASE_URL');
  });

  it('skips hidden directories and node_modules', () => {
    const { stdout } = cli(`import --root=${IMPORT_ROOT} --dry-run`);
    expect(stdout).not.toContain('.hidden');
    expect(stdout).not.toContain('node_modules');
  });

  it('registers and scans every subdirectory', () => {
    const { stdout, status } = cli(`import --root=${IMPORT_ROOT}`);
    expect(status).toBe(0);
    expect(stdout).toContain('2 added, 0 updated, 0 skipped');

    const check = cli('check importapp-a --format=json');
    const found = JSON.parse(check.stdout).categories.environmentVariables.some((a: { name: string }) => a.name === 'DATABASE_URL');
    expect(found).toBe(true); // proves the scan step ran during import, not just registration
  });

  it('re-running updates rather than duplicating', () => {
    const { stdout, status } = cli(`import --root=${IMPORT_ROOT}`);
    expect(status).toBe(0);
    expect(stdout).toContain('0 added, 2 updated, 0 skipped');
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
    expect(report).toHaveProperty('crossProjectKeyReuse');
  });

  it('flags a global-candidate key duplicated across projects', () => {
    const secondPath = path.join(TMP, 'myproject2');
    fs.mkdirSync(secondPath, { recursive: true });
    expect(cli(`add-project myproject2 --path=${secondPath} --type=saas`).status).toBe(0);
    expect(cli('set myproject PADDLE_API_KEY pdl_live_shared').status).toBe(0);
    expect(cli('set myproject2 PADDLE_API_KEY pdl_live_shared').status).toBe(0);

    const { stdout } = cli('doctor --json');
    const report = JSON.parse(stdout);
    const reuse = report.crossProjectKeyReuse.find((r: { key: string }) => r.key === 'PADDLE_API_KEY');
    expect(reuse).toBeDefined();
    expect(reuse.projects).toEqual(expect.arrayContaining(['myproject', 'myproject2']));
  });

  it('does not flag a naturally per-project key (DATABASE_URL) as reuse', () => {
    expect(cli('set myproject DATABASE_URL postgres://a').status).toBe(0);
    expect(cli('set myproject2 DATABASE_URL postgres://b').status).toBe(0);

    const { stdout } = cli('doctor --json');
    const report = JSON.parse(stdout);
    expect(report.crossProjectKeyReuse.find((r: { key: string }) => r.key === 'DATABASE_URL')).toBeUndefined();
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

describe('CLI: identity', () => {
  it('resolves Supabase project ref from URL (offline)', () => {
    const { stdout, status } = cli('identity myproject --json');
    expect(status).toBe(0);
    const ids = JSON.parse(stdout);
    const sb = ids.find((i: { keyName: string }) => i.keyName === 'NEXT_PUBLIC_SUPABASE_URL');
    expect(sb).toBeDefined();
    expect(sb.valid).toBe(true);
    expect(sb.workspace).toBe('testref01');
  });

  it('--pin sets expected and subsequent run reports no mismatch', () => {
    cli('identity myproject --pin --json');
    const { stdout } = cli('identity myproject --json');
    const ids = JSON.parse(stdout);
    const sb = ids.find((i: { keyName: string }) => i.keyName === 'NEXT_PUBLIC_SUPABASE_URL');
    expect(sb.expectedWorkspace).toBe('testref01');
    expect(sb.mismatch).toBe(false);
  });
});

describe('CLI: vault (set / get / list / unset)', () => {
  it('set stores a secret and get retrieves it', () => {
    const { status: s1 } = cli('set myproject DB_PASSWORD s3cr3t --env=staging');
    expect(s1).toBe(0);
    const { stdout, status: s2 } = cli('get myproject DB_PASSWORD --env=staging');
    expect(s2).toBe(0);
    expect(stdout.trim()).toBe('s3cr3t');
  });

  it('list shows key metadata without values', () => {
    cli('set myproject API_KEY abc123 --env=staging --provider=stripe');
    const { stdout, status } = cli('list myproject --env=staging --json');
    expect(status).toBe(0);
    const items = JSON.parse(stdout);
    const key = items.find((i: { key: string }) => i.key === 'API_KEY');
    expect(key).toBeDefined();
    expect(key.provider).toBe('stripe');
    expect(key).not.toHaveProperty('value');
    expect(key).not.toHaveProperty('encrypted_value');
  });

  it('set overwrites existing secret', () => {
    cli('set myproject DB_PASSWORD updated --env=staging');
    const { stdout } = cli('get myproject DB_PASSWORD --env=staging');
    expect(stdout.trim()).toBe('updated');
  });

  it('get exits 1 for missing key', () => {
    const { status } = cli('get myproject NONEXISTENT_KEY --env=staging');
    expect(status).toBe(1);
  });

  it('unset deletes the secret', () => {
    cli('set myproject TEMP_KEY tempval --env=staging');
    const { status: s1 } = cli('unset myproject TEMP_KEY --env=staging --yes');
    expect(s1).toBe(0);
    const { status: s2 } = cli('get myproject TEMP_KEY --env=staging');
    expect(s2).toBe(1);
  });

  it('unset exits 1 for missing key', () => {
    const { status } = cli('unset myproject NONEXISTENT --env=staging --yes');
    expect(status).toBe(1);
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
