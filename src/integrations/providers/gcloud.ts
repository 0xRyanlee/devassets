import fs from 'fs';
import type { ResolvedIdentity } from '../../types/index.js';

// GCloud credentials carry identity inline: parse client_email + project_id.
// Value may be: a path to the JSON key, raw JSON, or base64-encoded JSON.
export async function resolve(value: string): Promise<ResolvedIdentity> {
  let json: { client_email?: string; project_id?: string } | null = null;

  try {
    if (value.startsWith('{')) {
      json = JSON.parse(value);
    } else if (fs.existsSync(value)) {
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
