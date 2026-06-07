import { scanEnvKeys } from '../utils/dotenv.js';
import { readEnvValue } from '../utils/dotenv.js';
import { matchProvider } from '../integrations/providers/index.js';
import { upsertCredentialIdentity, getCredentialIdentities } from '../db/queries.js';
import type { Project, ProviderIdentity } from '../types/index.js';

export async function resolveProjectIdentities(project: Project): Promise<ProviderIdentity[]> {
  const keys = scanEnvKeys(project.path);
  const seen = new Set<string>();
  const now = new Date().toISOString();
  const results: ProviderIdentity[] = [];

  for (const key of keys) {
    if (seen.has(key.name)) continue;
    const entry = matchProvider(key.name);
    if (!entry) continue;
    seen.add(key.name);

    const value = readEnvValue(project.path, key.name);
    if (!value) {
      results.push({ provider: entry.provider, keyName: key.name, valid: false, error: 'value not set', checkedAt: now });
      continue;
    }

    // value is used transiently here and never persisted
    const resolved = await entry.resolve(value);
    const identity: ProviderIdentity = { ...resolved, keyName: key.name, checkedAt: now };
    upsertCredentialIdentity(project.id, identity);
    results.push(identity);
  }

  // return cached versions so mismatch (against pinned expectations) is computed
  return getCredentialIdentities(project.id).filter(i => seen.has(i.keyName));
}
