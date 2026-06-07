import type { ResolvedIdentity } from '../../types/index.js';

// Resolve a Supabase personal access token (sbp_...) via the Management API
export async function resolveToken(token: string): Promise<ResolvedIdentity> {
  try {
    const res = await fetch('https://api.supabase.com/v1/projects', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { provider: 'supabase', valid: false, error: `Supabase API ${res.status} — token invalid or expired` };
    }
    const projects = await res.json() as { id: string; name: string; organization_id: string }[];
    const orgs = [...new Set(projects.map(p => p.organization_id))];
    return {
      provider: 'supabase',
      valid: true,
      account: orgs.join(', ') || undefined,
      workspace: orgs[0],
      projects: projects.map(p => `${p.name} (${p.id})`),
    };
  } catch (err) {
    return { provider: 'supabase', valid: false, error: err instanceof Error ? err.message : 'unreachable' };
  }
}

// Resolve the project ref directly from a SUPABASE_URL without any API call
export async function resolveUrl(url: string): Promise<ResolvedIdentity> {
  const match = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.(co|in|net)/i);
  if (!match) {
    return { provider: 'supabase', valid: false, error: 'SUPABASE_URL did not match expected format' };
  }
  return {
    provider: 'supabase',
    valid: true,
    workspace: match[1],
    projects: [match[1]],
  };
}
