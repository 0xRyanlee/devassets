import type { ResolvedIdentity } from '../../types/index.js';
import { fetchAuthedJson } from './http.js';

export async function resolve(token: string): Promise<ResolvedIdentity> {
  const result = await fetchAuthedJson<{ username: string }>('npm registry', 'https://registry.npmjs.org/-/whoami', token);
  if (!result.ok) return { provider: 'npm', valid: false, error: result.error };
  return { provider: 'npm', valid: true, account: result.data.username };
}
