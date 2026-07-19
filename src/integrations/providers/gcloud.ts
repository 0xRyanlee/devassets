import fs from 'fs';
import path from 'path';
import type { ResolvedIdentity } from '../../types/index.js';

// GCloud credentials carry identity inline: parse client_email + project_id.
// Value may be: a path to the JSON key, raw JSON, or base64-encoded JSON.
export async function resolve(value: string, context?: { projectPath: string }): Promise<ResolvedIdentity> {
  let json: { client_email?: string; project_id?: string } | null = null;

  try {
    if (value.startsWith('{')) {
      json = JSON.parse(value);
    } else if (fs.existsSync(value)) {
      // GOOGLE_APPLICATION_CREDENTIALS's *value* comes from a scanned project's own .env file —
      // an untrusted/malicious project could point it at an arbitrary absolute path (e.g. another
      // real service-account JSON on the same machine). Only read it if it falls inside the
      // project being resolved; the caller not passing a projectPath is treated as "don't read".
      if (!context || !isWithinProject(context.projectPath, value)) {
        return { provider: 'gcloud', valid: false, error: 'credential path is outside the project directory — refusing to read' };
      }
      json = JSON.parse(fs.readFileSync(value, 'utf-8'));
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

function isWithinProject(projectPath: string, filePath: string): boolean {
  const root = path.resolve(projectPath);
  const abs = path.resolve(filePath);
  return abs === root || abs.startsWith(root + path.sep);
}
