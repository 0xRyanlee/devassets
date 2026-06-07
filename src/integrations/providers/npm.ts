import type { ResolvedIdentity } from '../../types/index.js';

export async function resolve(token: string): Promise<ResolvedIdentity> {
  try {
    const res = await fetch('https://registry.npmjs.org/-/whoami', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { provider: 'npm', valid: false, error: `npm registry ${res.status} — token invalid or expired` };
    }
    const { username } = await res.json() as { username: string };
    return { provider: 'npm', valid: true, account: username };
  } catch (err) {
    return { provider: 'npm', valid: false, error: err instanceof Error ? err.message : 'unreachable' };
  }
}
