import { getDb } from './index.js';
import { encryptVault, decryptVault } from '../utils/crypto.js';
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

const MAX_IDENTITY_FIELD = 1024;
const MAX_PROJECTS_JSON = 8192;

export function upsertCredentialIdentity(projectId: string, id: ProviderIdentity) {
  const db = getDb();
  const rawProjects = id.projects ? JSON.stringify(id.projects) : null;
  const projects = rawProjects && rawProjects.length > MAX_PROJECTS_JSON
    ? rawProjects.slice(0, MAX_PROJECTS_JSON) + '…'
    : rawProjects;
  const account = id.account && id.account.length > MAX_IDENTITY_FIELD ? id.account.slice(0, MAX_IDENTITY_FIELD) : id.account;
  const workspace = id.workspace && id.workspace.length > MAX_IDENTITY_FIELD ? id.workspace.slice(0, MAX_IDENTITY_FIELD) : id.workspace;
  const existing = db.prepare('SELECT expected_account, expected_workspace FROM credential_identities WHERE project_id=? AND key_name=?').get(projectId, id.keyName) as Row | undefined;
  if (existing) {
    db.prepare('UPDATE credential_identities SET provider=?, account=?, workspace=?, projects=?, valid=?, error=?, checked_at=? WHERE project_id=? AND key_name=?')
      .run(id.provider, account ?? null, workspace ?? null, projects, id.valid ? 1 : 0, id.error ?? null, id.checkedAt, projectId, id.keyName);
  } else {
    db.prepare('INSERT INTO credential_identities (project_id, key_name, provider, account, workspace, projects, valid, error, checked_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(projectId, id.keyName, id.provider, account ?? null, workspace ?? null, projects, id.valid ? 1 : 0, id.error ?? null, id.checkedAt);
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

// ── Vault ────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';

export interface VaultSecretMeta {
  key: string;
  env: string;
  provider?: string;
  accountHint?: string;
  workspaceHint?: string;
  updatedAt: string;
}

export function setVaultSecret(
  projectId: string,
  env: string,
  key: string,
  plaintext: string,
  hints?: { provider?: string; account?: string; workspace?: string },
) {
  const db = getDb();
  const { ciphertext, iv, authTag } = encryptVault(plaintext);
  const now = new Date().toISOString();
  // Single atomic upsert — avoids SELECT+INSERT/UPDATE race condition under parallel invocations
  db.prepare(
    `INSERT INTO secret_values (id, project_id, env, key, encrypted_value, iv, auth_tag, provider, account_hint, workspace_hint, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(project_id, env, key) DO UPDATE SET
       encrypted_value=excluded.encrypted_value, iv=excluded.iv, auth_tag=excluded.auth_tag,
       provider=excluded.provider, account_hint=excluded.account_hint, workspace_hint=excluded.workspace_hint,
       updated_at=excluded.updated_at`,
  ).run(randomUUID(), projectId, env, key, ciphertext, iv, authTag, hints?.provider ?? null, hints?.account ?? null, hints?.workspace ?? null, now, now);
}

export function getVaultSecret(projectId: string, env: string, key: string): string | undefined {
  const db = getDb();
  const r = db.prepare('SELECT encrypted_value, iv, auth_tag FROM secret_values WHERE project_id=? AND env=? AND key=?').get(projectId, env, key) as Row | undefined;
  if (!r) return undefined;
  try {
    return decryptVault(r['encrypted_value'] as string, r['iv'] as string, r['auth_tag'] as string);
  } catch {
    throw new Error(`Decryption failed for ${key} [${env}]. The vault key may have changed. Re-store with: devassets set ${projectId} ${key}`);
  }
}

export function listVaultSecrets(projectId: string, env?: string): VaultSecretMeta[] {
  const db = getDb();
  const rows = env
    ? (db.prepare('SELECT key, env, provider, account_hint, workspace_hint, updated_at FROM secret_values WHERE project_id=? AND env=? ORDER BY env, key').all(projectId, env) as Row[])
    : (db.prepare('SELECT key, env, provider, account_hint, workspace_hint, updated_at FROM secret_values WHERE project_id=? ORDER BY env, key').all(projectId) as Row[]);
  return rows.map(r => ({
    key: r['key'] as string,
    env: r['env'] as string,
    provider: (r['provider'] as string) ?? undefined,
    accountHint: (r['account_hint'] as string) ?? undefined,
    workspaceHint: (r['workspace_hint'] as string) ?? undefined,
    updatedAt: r['updated_at'] as string,
  }));
}

export function deleteVaultSecret(projectId: string, env: string, key: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM secret_values WHERE project_id=? AND env=? AND key=?').run(projectId, env, key);
  return (result as { changes: number }).changes > 0;
}

// Search across ALL projects' vaults by key name — returns metadata only, never plaintext values.
export function findSecretAcrossProjects(key: string, env?: string): Array<VaultSecretMeta & { projectId: string }> {
  const db = getDb();
  const rows = env
    ? (db.prepare('SELECT project_id, key, env, provider, account_hint, workspace_hint, updated_at FROM secret_values WHERE key=? AND env=? ORDER BY project_id, env').all(key, env) as Row[])
    : (db.prepare('SELECT project_id, key, env, provider, account_hint, workspace_hint, updated_at FROM secret_values WHERE key=? ORDER BY project_id, env').all(key) as Row[]);
  return rows.map(r => ({
    projectId: r['project_id'] as string,
    key: r['key'] as string,
    env: r['env'] as string,
    provider: (r['provider'] as string) ?? undefined,
    accountHint: (r['account_hint'] as string) ?? undefined,
    workspaceHint: (r['workspace_hint'] as string) ?? undefined,
    updatedAt: r['updated_at'] as string,
  }));
}

// Get a vault secret, falling back to other projects' vaults if not found in the primary project.
// Searches primary project first, then all other projects in vault order.
export function getVaultSecretFallback(
  primaryProjectId: string,
  env: string,
  key: string,
): { value: string; sourceProject: string } | undefined {
  const own = getVaultSecret(primaryProjectId, env, key);
  if (own !== undefined) return { value: own, sourceProject: primaryProjectId };

  const matches = findSecretAcrossProjects(key, env);
  for (const match of matches) {
    if (match.projectId === primaryProjectId) continue;
    try {
      const v = getVaultSecret(match.projectId, env, key);
      if (v !== undefined) return { value: v, sourceProject: match.projectId };
    } catch {
      // Vault key mismatch on another project entry — skip silently
    }
  }
  return undefined;
}

// Return count of vault secrets per project (no values), used for doctor summary.
export function getVaultSecretCounts(): Record<string, number> {
  const db = getDb();
  const rows = db.prepare('SELECT project_id, COUNT(*) as cnt FROM secret_values GROUP BY project_id').all() as Row[];
  return Object.fromEntries(rows.map(r => [r['project_id'] as string, r['cnt'] as number]));
}
