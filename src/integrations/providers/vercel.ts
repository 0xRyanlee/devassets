import type { ResolvedIdentity } from '../../types/index.js';

export async function resolve(token: string): Promise<ResolvedIdentity> {
  try {
    const userRes = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!userRes.ok) {
      return { provider: 'vercel', valid: false, error: `Vercel API ${userRes.status} — token invalid or expired` };
    }
    const { user } = await userRes.json() as { user: { username: string; email: string } };

    let teams: string[] = [];
    try {
      const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (teamsRes.ok) {
        const data = await teamsRes.json() as { teams: { slug: string }[] };
        teams = (data.teams ?? []).map(t => t.slug);
      }
    } catch { /* teams optional */ }

    return {
      provider: 'vercel',
      valid: true,
      account: user.email ?? user.username,
      workspace: teams.join(', ') || undefined,
    };
  } catch (err) {
    return { provider: 'vercel', valid: false, error: err instanceof Error ? err.message : 'unreachable' };
  }
}
