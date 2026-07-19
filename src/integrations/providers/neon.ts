import type { ResolvedIdentity } from '../../types/index.js';
import { fetchAuthedJson, fetchAuthedJsonOptional } from './http.js';

export async function resolve(token: string): Promise<ResolvedIdentity> {
  const result = await fetchAuthedJson<{ email?: string; login?: string }>('Neon', 'https://console.neon.tech/api/v2/users/me', token);
  if (!result.ok) return { provider: 'neon', valid: false, error: result.error };
  const me = result.data;

  const projData = await fetchAuthedJsonOptional<{ projects: { name: string; id: string }[] }>('https://console.neon.tech/api/v2/projects', token);
  const projects = (projData?.projects ?? []).map(p => `${p.name} (${p.id})`);

  return {
    provider: 'neon',
    valid: true,
    account: me.email ?? me.login,
    projects,
  };
}
