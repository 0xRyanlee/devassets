import { getDb } from './index.js';
import { encryptVault, decryptVault } from '../utils/crypto.js';
import type { Project, Asset, PaymentPlatform, AuditLog, ProviderIdentity, SecretScope, PaymentStatus } from '../types/index.js';

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
  const db = getDb();
  // FK CASCADE requires PRAGMA foreign_keys=ON which is not globally enabled;
  // delete dependent rows explicitly to avoid orphaned vault data.
  db.prepare('DELETE FROM secret_values WHERE project_id=?').run(id);
  db.prepare('DELETE FROM assets WHERE project_id=?').run(id);
  db.prepare('DELETE FROM payment_platforms WHERE project_id=?').run(id);
  db.prepare('DELETE FROM credential_identities WHERE project_id=?').run(id);
  db.prepare('DELETE FROM projects WHERE id=?').run(id);
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

// checkCommand/devassets_check compute live payment status (Paddle/Stripe API calls) but used to
// only hold it in memory for that one response — payment_platforms stayed at whatever `scan` last
// wrote (usually 'unconfigured'), so `devassets doctor`/`status`/anything else reading the table
// saw a stale value even right after a successful check. This is the single write-back point both
// the CLI and MCP `check` handlers call so payment_platforms reflects the last real check result.
export function persistPaymentStatuses(projectId: string, statuses: PaymentStatus[], timestamp: string) {
  for (const s of statuses) {
    upsertPaymentPlatform({
      projectId,
      name: s.platform,
      status: mapCheckStatusToPlatformStatus(s.status),
      lastVerified: timestamp,
      metadata: { webhook: s.webhook, apiKeyAgeDays: s.apiKeyAgeDays, riskCount: s.risks.length },
    });
  }
}

function mapCheckStatusToPlatformStatus(status: PaymentStatus['status']): PaymentPlatform['status'] {
  switch (status) {
    case 'healthy': return 'connected';
    case 'warning': return 'connected';
    case 'critical': return 'error';
    case 'unconfigured': return 'unconfigured';
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

function mapAuditLogRow(r: Row): AuditLog {
  return {
    id: r['id'] as number,
    projectId: r['project_id'] as string,
    action: r['action'] as string,
    user: r['user'] as string,
    timestamp: r['timestamp'] as string,
    details: r['details'] ? JSON.parse(r['details'] as string) : undefined,
    result: r['result'] as AuditLog['result'],
  };
}

export function getLastScanLog(projectId: string): AuditLog | undefined {
  const db = getDb();
  const r = db.prepare(
    "SELECT * FROM audit_logs WHERE project_id=? AND action='scan' ORDER BY timestamp DESC LIMIT 1"
  ).get(projectId) as Row | undefined;
  return r ? mapAuditLogRow(r) : undefined;
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
  return rows.map(mapAuditLogRow);
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
  scope: SecretScope;
  provider?: string;
  accountHint?: string;
  workspaceHint?: string;
  encoding: 'utf8' | 'base64';
  originalFilename?: string;
  updatedAt: string;
}

export function setVaultSecret(
  projectId: string,
  env: string,
  key: string,
  plaintext: string,
  hints?: { provider?: string; account?: string; workspace?: string; encoding?: 'utf8' | 'base64'; filename?: string },
  scope: 'global' | 'project' = 'project',
) {
  const db = getDb();
  const effectiveProjectId = scope === 'global' ? '_global' : projectId;
  const { ciphertext, iv, authTag } = encryptVault(plaintext);
  const now = new Date().toISOString();
  // Single atomic upsert — avoids SELECT+INSERT/UPDATE race condition under parallel invocations
  db.prepare(
    `INSERT INTO secret_values (id, project_id, env, key, encrypted_value, iv, auth_tag, provider, account_hint, workspace_hint, scope, encoding, original_filename, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(project_id, env, key) DO UPDATE SET
       encrypted_value=excluded.encrypted_value, iv=excluded.iv, auth_tag=excluded.auth_tag,
       provider=excluded.provider, account_hint=excluded.account_hint, workspace_hint=excluded.workspace_hint,
       scope=excluded.scope, encoding=excluded.encoding, original_filename=excluded.original_filename,
       updated_at=excluded.updated_at`,
  ).run(randomUUID(), effectiveProjectId, env, key, ciphertext, iv, authTag, hints?.provider ?? null, hints?.account ?? null, hints?.workspace ?? null, scope, hints?.encoding ?? 'utf8', hints?.filename ?? null, now, now);
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

export function getVaultSecretWithMeta(projectId: string, env: string, key: string): { value: string; encoding: 'utf8' | 'base64'; originalFilename?: string } | undefined {
  const db = getDb();
  const r = db.prepare('SELECT encrypted_value, iv, auth_tag, encoding, original_filename FROM secret_values WHERE project_id=? AND env=? AND key=?').get(projectId, env, key) as Row | undefined;
  if (!r) return undefined;
  try {
    const value = decryptVault(r['encrypted_value'] as string, r['iv'] as string, r['auth_tag'] as string);
    return {
      value,
      encoding: ((r['encoding'] as string) === 'base64' ? 'base64' : 'utf8'),
      originalFilename: (r['original_filename'] as string) ?? undefined,
    };
  } catch {
    throw new Error(`Decryption failed for ${key} [${env}]. The vault key may have changed. Re-store with: devassets set ${projectId} ${key}`);
  }
}

export function listVaultSecrets(projectId: string, env?: string, scope?: SecretScope): VaultSecretMeta[] {
  const db = getDb();
  // global-scoped secrets only exist under _global — ignore caller's projectId
  const effectiveProjectId = scope === 'global' ? '_global' : projectId;
  const cols = 'key, env, scope, provider, account_hint, workspace_hint, encoding, original_filename, updated_at';
  let rows: Row[];
  if (env && scope) {
    rows = db.prepare(`SELECT ${cols} FROM secret_values WHERE project_id=? AND env=? AND scope=? ORDER BY env, key`).all(effectiveProjectId, env, scope) as Row[];
  } else if (env) {
    rows = db.prepare(`SELECT ${cols} FROM secret_values WHERE project_id=? AND env=? ORDER BY env, key`).all(effectiveProjectId, env) as Row[];
  } else if (scope) {
    rows = db.prepare(`SELECT ${cols} FROM secret_values WHERE project_id=? AND scope=? ORDER BY env, key`).all(effectiveProjectId, scope) as Row[];
  } else {
    rows = db.prepare(`SELECT ${cols} FROM secret_values WHERE project_id=? ORDER BY env, key`).all(effectiveProjectId) as Row[];
  }
  return rows.map(r => ({
    key: r['key'] as string,
    env: r['env'] as string,
    scope: (r['scope'] as SecretScope) ?? 'project',
    provider: (r['provider'] as string) ?? undefined,
    accountHint: (r['account_hint'] as string) ?? undefined,
    workspaceHint: (r['workspace_hint'] as string) ?? undefined,
    encoding: ((r['encoding'] as string) === 'base64' ? 'base64' : 'utf8'),
    originalFilename: (r['original_filename'] as string) ?? undefined,
    updatedAt: r['updated_at'] as string,
  }));
}

function queryVaultSecretScope(projectId: string, env: string, key: string): SecretScope {
  const db = getDb();
  const r = db.prepare('SELECT scope FROM secret_values WHERE project_id=? AND env=? AND key=?').get(projectId, env, key) as Row | undefined;
  return (r?.['scope'] as SecretScope) ?? 'project';
}

export function deleteVaultSecret(projectId: string, env: string, key: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM secret_values WHERE project_id=? AND env=? AND key=?').run(projectId, env, key);
  return (result as { changes: number }).changes > 0;
}

// Search across ALL projects' vaults by key name — returns metadata only, never plaintext values.
export function findSecretAcrossProjects(key: string, env?: string, scope?: SecretScope): Array<VaultSecretMeta & { projectId: string }> {
  const db = getDb();
  const cols = 'project_id, key, env, scope, provider, account_hint, workspace_hint, encoding, original_filename, updated_at';
  let rows: Row[];
  if (env && scope) {
    rows = db.prepare(`SELECT ${cols} FROM secret_values WHERE key=? AND env=? AND scope=? ORDER BY project_id, env`).all(key, env, scope) as Row[];
  } else if (env) {
    rows = db.prepare(`SELECT ${cols} FROM secret_values WHERE key=? AND env=? ORDER BY project_id, env`).all(key, env) as Row[];
  } else if (scope) {
    rows = db.prepare(`SELECT ${cols} FROM secret_values WHERE key=? AND scope=? ORDER BY project_id, env`).all(key, scope) as Row[];
  } else {
    rows = db.prepare(`SELECT ${cols} FROM secret_values WHERE key=? ORDER BY project_id, env`).all(key) as Row[];
  }
  return rows.map(r => ({
    projectId: r['project_id'] as string,
    key: r['key'] as string,
    env: r['env'] as string,
    scope: (r['scope'] as 'global' | 'project') ?? 'project',
    provider: (r['provider'] as string) ?? undefined,
    accountHint: (r['account_hint'] as string) ?? undefined,
    workspaceHint: (r['workspace_hint'] as string) ?? undefined,
    encoding: ((r['encoding'] as string) === 'base64' ? 'base64' : 'utf8') as 'utf8' | 'base64',
    originalFilename: (r['original_filename'] as string) ?? undefined,
    updatedAt: r['updated_at'] as string,
  }));
}

// Get a vault secret, falling back to _global then other projects.
// Lookup order: primary project → _global (account-level) → other projects.
// Only checks the primary project and _global — never falls back to an unrelated project's vault
// entry, which would silently hand one project's credential to another (findSecretAcrossProjects
// remains available separately for surfacing "found elsewhere" as a discoverability hint, not as
// a value source).
export function getVaultSecretFallback(
  primaryProjectId: string,
  env: string,
  key: string,
): { value: string; sourceProject: string; scope: SecretScope } | undefined {
  const own = getVaultSecret(primaryProjectId, env, key);
  if (own !== undefined) return { value: own, sourceProject: primaryProjectId, scope: queryVaultSecretScope(primaryProjectId, env, key) };

  if (primaryProjectId !== '_global') {
    try {
      const globalVal = getVaultSecret('_global', env, key);
      if (globalVal !== undefined) return { value: globalVal, sourceProject: '_global', scope: queryVaultSecretScope('_global', env, key) };
    } catch {
      // vault key mismatch in _global — skip
    }
  }

  return undefined;
}

// Retrieve an account-level global credential directly without specifying a project.
export function getGlobalSecret(key: string, env: string): string | undefined {
  return getVaultSecret('_global', env, key);
}

export interface ResolvedInjectionSecret {
  key: string;
  value: string;
  sourceProjectId: string;
}

// Shared by `inject` and `run`: merges project-scoped and _global vault entries (project keys
// shadow same-named global keys), optionally filters to a specific key list, then resolves each
// to its plaintext value. A single entry failing to decrypt (vault key mismatch) is skipped
// rather than aborting the whole batch.
export function resolveInjectionTargets(
  projectId: string,
  env: string,
  keys?: string[],
): ResolvedInjectionSecret[] {
  const own = listVaultSecrets(projectId, env);
  const globalAll = projectId === '_global' ? [] : listVaultSecrets('_global', env);
  const ownKeys = new Set(own.map(s => s.key));
  const globalOnly = globalAll.filter(s => !ownKeys.has(s.key));
  const merged = [...globalOnly, ...own];
  const filtered = keys && keys.length > 0 ? merged.filter(s => keys.includes(s.key)) : merged;

  const resolved: ResolvedInjectionSecret[] = [];
  for (const meta of filtered) {
    const sourceProjectId = globalOnly.some(g => g.key === meta.key) ? '_global' : projectId;
    try {
      const value = getVaultSecret(sourceProjectId, env, meta.key);
      if (value !== undefined) resolved.push({ key: meta.key, value, sourceProjectId });
    } catch {
      // vault key mismatch on this entry — skip rather than aborting the whole injection
    }
  }
  return resolved;
}

// Return count of vault secrets per project (no values), used for doctor summary.
export function getVaultSecretCounts(): Record<string, number> {
  const db = getDb();
  const rows = db.prepare('SELECT project_id, COUNT(*) as cnt FROM secret_values GROUP BY project_id').all() as Row[];
  return Object.fromEntries(rows.map(r => [r['project_id'] as string, r['cnt'] as number]));
}
