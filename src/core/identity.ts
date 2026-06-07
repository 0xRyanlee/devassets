import path from 'path';
import { scanEnvKeys, readEnvValue } from '../utils/dotenv.js';
import { resolveScanRoots } from './roots.js';
import { matchProvider } from '../integrations/providers/index.js';
import { upsertCredentialIdentity, getCredentialIdentities } from '../db/queries.js';
import type { Project, ProviderIdentity } from '../types/index.js';

export async function resolveProjectIdentities(project: Project): Promise<ProviderIdentity[]> {
  const roots = resolveScanRoots(project.path);
  const seen = new Set<string>();
  const now = new Date().toISOString();

  for (const root of roots) {
    const rootAbs = path.join(project.path, root);
    for (const key of scanEnvKeys(rootAbs)) {
      if (seen.has(key.name)) continue;
      const entry = matchProvider(key.name);
      if (!entry) continue;
      seen.add(key.name);

      const value = readEnvValue(rootAbs, key.name);
      if (!value) {
        const identity: ProviderIdentity = { provider: entry.provider, keyName: key.name, valid: false, error: 'value not set', checkedAt: now };
        upsertCredentialIdentity(project.id, identity);
        continue;
      }

      // value is used transiently here and never persisted
      const resolved = await entry.resolve(value);
      upsertCredentialIdentity(project.id, { ...resolved, keyName: key.name, checkedAt: now });
    }
  }

  return getCredentialIdentities(project.id).filter(i => seen.has(i.keyName));
}
