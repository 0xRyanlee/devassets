import type { ResolvedIdentity } from '../../types/index.js';

export async function resolve(token: string): Promise<ResolvedIdentity> {
  try {
    const meRes = await fetch('https://console.neon.tech/api/v2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!meRes.ok) {
      return { provider: 'neon', valid: false, error: `Neon API ${meRes.status} — token invalid or expired` };
    }
    const me = await meRes.json() as { email?: string; login?: string };

    let projects: string[] = [];
    try {
      const projRes = await fetch('https://console.neon.tech/api/v2/projects', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (projRes.ok) {
        const data = await projRes.json() as { projects: { name: string; id: string }[] };
        projects = (data.projects ?? []).map(p => `${p.name} (${p.id})`);
      }
    } catch { /* projects optional */ }

    return {
      provider: 'neon',
      valid: true,
      account: me.email ?? me.login,
      projects,
    };
  } catch (err) {
    return { provider: 'neon', valid: false, error: err instanceof Error ? err.message : 'unreachable' };
  }
}
