import fs from 'fs';
import path from 'path';
import type { ResolvedIdentity } from '../../types/index.js';
import { isWithinRealPath } from '../../utils/fs-safety.js';

// GCloud credentials carry identity inline: parse client_email + project_id.
// Value may be: a path to the JSON key, raw JSON, or base64-encoded JSON.
export async function resolve(value: string, context?: { projectPath: string }): Promise<ResolvedIdentity> {
  let json: { client_email?: string; project_id?: string } | null = null;

  try {
    if (value.startsWith('{')) {
      json = JSON.parse(value);
    } else if (looksLikeFilePath(value, context?.projectPath)) {
      // GOOGLE_APPLICATION_CREDENTIALS's *value* comes from a scanned project's own .env file —
      // an untrusted/malicious project could point it at an arbitrary path (e.g. another real
      // service-account JSON on the same machine, or a symlink to one). Relative values resolve
      // against the project's own path, not this process's cwd. Only read it if the REAL
      // (symlink-resolved) path falls inside the project being resolved; the caller not passing a
      // projectPath is treated as "don't read".
      if (!context) {
        return { provider: 'gcloud', valid: false, error: 'credential path is outside the project directory — refusing to read' };
      }
      const resolved = path.isAbsolute(value) ? value : path.resolve(context.projectPath, value);
      if (!isWithinRealPath(context.projectPath, resolved)) {
        return { provider: 'gcloud', valid: false, error: 'credential path is outside the project directory — refusing to read' };
      }
      json = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    } else {
      const decoded = Buffer.from(value, 'base64').toString('utf-8');
      if (decoded.startsWith('{')) json = JSON.parse(decoded);
    }
  } catch {
    return { provider: 'gcloud', valid: false, error: 'could not parse service account credentials' };
  }

  if (!json?.project_id) {
    return { provider: 'gcloud', valid: false, error: 'no project_id found in credentials' };
  }

  return {
    provider: 'gcloud',
    valid: true,
    account: json.client_email,
    workspace: json.project_id,
    projects: [json.project_id],
  };
}

// Mirrors the original "does this look like a path that exists" check, but resolves relative
// values against the project path (when known) instead of process.cwd() before testing.
function looksLikeFilePath(value: string, projectPath?: string): boolean {
  const resolved = path.isAbsolute(value) || !projectPath ? value : path.resolve(projectPath, value);
  return fs.existsSync(resolved);
}
