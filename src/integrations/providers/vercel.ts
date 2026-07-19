import type { ResolvedIdentity } from '../../types/index.js';
import { fetchAuthedJson, fetchAuthedJsonOptional } from './http.js';

export async function resolve(token: string): Promise<ResolvedIdentity> {
  const result = await fetchAuthedJson<{ user: { username: string; email: string } }>('Vercel', 'https://api.vercel.com/v2/user', token);
  if (!result.ok) return { provider: 'vercel', valid: false, error: result.error };
  const { user } = result.data;

  const teamsData = await fetchAuthedJsonOptional<{ teams: { slug: string }[] }>('https://api.vercel.com/v2/teams', token);
  const teams = (teamsData?.teams ?? []).map(t => t.slug);

  return {
    provider: 'vercel',
    valid: true,
    account: user.email ?? user.username,
    workspace: teams.join(', ') || undefined,
  };
}
