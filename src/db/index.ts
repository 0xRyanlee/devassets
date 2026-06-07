import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { DB_PATH, DEVASSETS_DIR } from '../utils/constants.js';

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    fs.mkdirSync(DEVASSETS_DIR, { recursive: true });
    _db = new DatabaseSync(DB_PATH);
    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'configured',
      environment TEXT,
      last_seen TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unconfigured',
      last_verified TEXT,
      metadata TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      action TEXT NOT NULL,
      user TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      details TEXT,
      result TEXT NOT NULL DEFAULT 'success'
    );

    CREATE TABLE IF NOT EXISTS credential_identities (
      project_id TEXT NOT NULL,
      key_name TEXT NOT NULL,
      provider TEXT NOT NULL,
      account TEXT,
      workspace TEXT,
      projects TEXT,
      valid INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      expected_account TEXT,
      expected_workspace TEXT,
      checked_at TEXT NOT NULL,
      PRIMARY KEY (project_id, key_name),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_cred_identities_project ON credential_identities(project_id);
  `);
}
