import { getDb } from './index.js';
import type { Project, Asset, PaymentPlatform, AuditLog, ProviderIdentity } from '../types/index.js';

type Row = Record<string, unknown>;

function row<T>(r: Row): T { return r as T; }

export function getProject(id: string): Project | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  const r = stmt.get(id) as Row | undefined;
  return r ? row<Project>(r) : undefined;
}

export function listProjects(): Project[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM projects ORDER BY name').all() as Row[]).map(r => row<Project>(r));
}

export function upsertProject(project: Omit<Project, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getProject(project.id);

  if (existing) {
    db.prepare('UPDATE projects SET name=?, path=?, type=?, updated_at=? WHERE id=?')
      .run(project.name, project.path, project.type, now, project.id);
  } else {
    db.prepare('INSERT INTO projects (id, name, path, type, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .run(project.id, project.name, project.path, project.type, project.createdAt ?? now, project.updatedAt ?? now);
  }
}

export function deleteProject(id: string) {
  getDb().prepare('DELETE FROM projects WHERE id=?').run(id);
}

export function getAssets(projectId: string, environment?: string): Asset[] {
  const db = getDb();
  // include assets tagged for this environment OR with no environment tag (applies to all envs)
  const rows = environment
    ? (db.prepare('SELECT * FROM assets WHERE project_id=? AND (environment=? OR environment IS NULL)').all(projectId, environment) as Row[])
    : (db.prepare('SELECT * FROM assets WHERE project_id=?').all(projectId) as Row[]);
  return rows.map(r => ({
    id: r['id'] as number,
    projectId: r['project_id'] as string,
    name: r['name'] as string,
    location: r['location'] as string,
    status: r['status'] as Asset['status'],
    environment: r['environment'] as Asset['environment'],
    lastSeen: r['last_seen'] as string,
  }));
}

export function replaceAssets(projectId: string, newAssets: Omit<Asset, 'id'>[], environment?: string) {
  const db = getDb();
  if (environment) {
    db.prepare('DELETE FROM assets WHERE project_id=? AND environment=?').run(projectId, environment);
  } else {
    db.prepare('DELETE FROM assets WHERE project_id=?').run(projectId);
  }
  const stmt = db.prepare('INSERT INTO assets (project_id, name, location, status, environment, last_seen) VALUES (?,?,?,?,?,?)');
  for (const a of newAssets) {
    stmt.run(a.projectId, a.name, a.location, a.status, a.environment ?? null, a.lastSeen);
  }
}

export function getPaymentPlatforms(projectId: string): PaymentPlatform[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM payment_platforms WHERE project_id=?').all(projectId) as Row[];
  return rows.map(r => ({
    id: r['id'] as number,
    projectId: r['project_id'] as string,
    name: r['name'] as PaymentPlatform['name'],
    status: r['status'] as PaymentPlatform['status'],
    lastVerified: r['last_verified'] as string | undefined,
    metadata: r['metadata'] ? JSON.parse(r['metadata'] as string) : undefined,
  }));
}

export function upsertPaymentPlatform(platform: Omit<PaymentPlatform, 'id'>) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM payment_platforms WHERE project_id=? AND name=?').get(platform.projectId, platform.name) as Row | undefined;
  const metadata = platform.metadata ? JSON.stringify(platform.metadata) : null;

  if (existing) {
    db.prepare('UPDATE payment_platforms SET status=?, last_verified=?, metadata=? WHERE id=?')
      .run(platform.status, platform.lastVerified ?? null, metadata, existing['id'] as number);
  } else {
    db.prepare('INSERT INTO payment_platforms (project_id, name, status, last_verified, metadata) VALUES (?,?,?,?,?)')
      .run(platform.projectId, platform.name, platform.status, platform.lastVerified ?? null, metadata);
  }
}

export function addAuditLog(log: Omit<AuditLog, 'id'>) {
  const db = getDb();
  let details: string | null = null;
  if (log.details) {
    try {
      const raw = JSON.stringify(log.details);
      details = raw.length > 4096 ? raw.slice(0, 4096) : raw;
    } catch {
      details = '{"error":"details_not_serializable"}';
    }
  }
  db.prepare('INSERT INTO audit_logs (project_id, action, user, timestamp, details, result) VALUES (?,?,?,?,?,?)')
    .run(log.projectId, log.action, log.user, log.timestamp, details, log.result);
}

export function getAuditLogs(projectId: string, sinceDays?: number): AuditLog[] {
  const db = getDb();
  let rows: Row[];
  if (sinceDays) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
    rows = db.prepare('SELECT * FROM audit_logs WHERE project_id=? AND timestamp>=? ORDER BY timestamp DESC').all(projectId, since) as Row[];
  } else {
    rows = db.prepare('SELECT * FROM audit_logs WHERE project_id=? ORDER BY timestamp DESC').all(projectId) as Row[];
  }
  return rows.map(r => ({
    id: r['id'] as number,
    projectId: r['project_id'] as string,
    action: r['action'] as string,
    user: r['user'] as string,
    timestamp: r['timestamp'] as string,
    details: r['details'] ? JSON.parse(r['details'] as string) : undefined,
    result: r['result'] as AuditLog['result'],
  }));
}

export function getCurrentUser(): string {
  return process.env.USER ?? process.env.USERNAME ?? 'owner';
}

export function getCredentialIdentities(projectId: string): ProviderIdentity[] {
  const rows = getDb().prepare('SELECT * FROM credential_identities WHERE project_id=? ORDER BY key_name').all(projectId) as Row[];
  return rows.map(r => ({
    keyName: r['key_name'] as string,
    provider: r['provider'] as string,
    account: (r['account'] as string) ?? undefined,
    workspace: (r['workspace'] as string) ?? undefined,
    projects: r['projects'] ? JSON.parse(r['projects'] as string) : undefined,
    valid: !!r['valid'],
    error: (r['error'] as string) ?? undefined,
    expectedAccount: (r['expected_account'] as string) ?? undefined,
    expectedWorkspace: (r['expected_workspace'] as string) ?? undefined,
    mismatch: computeMismatch(r['account'] as string, r['workspace'] as string, r['expected_account'] as string, r['expected_workspace'] as string),
    checkedAt: r['checked_at'] as string,
  }));
}

function computeMismatch(account?: string, workspace?: string, expAccount?: string, expWorkspace?: string): boolean {
  if (expAccount && account && expAccount !== account) return true;
  if (expWorkspace && workspace && expWorkspace !== workspace) return true;
  return false;
}

export function upsertCredentialIdentity(projectId: string, id: ProviderIdentity) {
  const db = getDb();
  const projects = id.projects ? JSON.stringify(id.projects) : null;
  const existing = db.prepare('SELECT expected_account, expected_workspace FROM credential_identities WHERE project_id=? AND key_name=?').get(projectId, id.keyName) as Row | undefined;
  if (existing) {
    db.prepare('UPDATE credential_identities SET provider=?, account=?, workspace=?, projects=?, valid=?, error=?, checked_at=? WHERE project_id=? AND key_name=?')
      .run(id.provider, id.account ?? null, id.workspace ?? null, projects, id.valid ? 1 : 0, id.error ?? null, id.checkedAt, projectId, id.keyName);
  } else {
    db.prepare('INSERT INTO credential_identities (project_id, key_name, provider, account, workspace, projects, valid, error, checked_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(projectId, id.keyName, id.provider, id.account ?? null, id.workspace ?? null, projects, id.valid ? 1 : 0, id.error ?? null, id.checkedAt);
  }
}

// Pin the currently-resolved account/workspace as the expected baseline; future drift will warn.
export function pinCredentialIdentity(projectId: string, keyName: string) {
  const db = getDb();
  const r = db.prepare('SELECT account, workspace FROM credential_identities WHERE project_id=? AND key_name=?').get(projectId, keyName) as Row | undefined;
  if (!r) return;
  db.prepare('UPDATE credential_identities SET expected_account=?, expected_workspace=? WHERE project_id=? AND key_name=?')
    .run((r['account'] as string | null) ?? null, (r['workspace'] as string | null) ?? null, projectId, keyName);
}
