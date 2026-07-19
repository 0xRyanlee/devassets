import type { ResolvedIdentity } from '../../types/index.js';
import * as vercel from './vercel.js';
import * as supabase from './supabase.js';
import * as neon from './neon.js';
import * as npm from './npm.js';
import * as gcloud from './gcloud.js';
import * as apple from './apple.js';

interface ProviderEntry {
  provider: string;
  keyPattern: RegExp;
  // context is currently only consumed by gcloud.resolve (to fence GOOGLE_APPLICATION_CREDENTIALS
  // file-path reads to within the project being scanned); other providers ignore it.
  resolve: (value: string, context?: { projectPath: string }) => Promise<ResolvedIdentity>;
}

// Order matters: more specific patterns first. First match per key name wins.
export const PROVIDERS: ProviderEntry[] = [
  { provider: 'vercel', keyPattern: /^VERCEL_(API_)?TOKEN$/i, resolve: vercel.resolve },
  { provider: 'supabase', keyPattern: /^SUPABASE_(ACCESS_TOKEN|PAT)$/i, resolve: supabase.resolveToken },
  { provider: 'supabase', keyPattern: /^(NEXT_PUBLIC_)?SUPABASE_URL$/i, resolve: supabase.resolveUrl },
  { provider: 'neon', keyPattern: /^NEON_API_KEY$/i, resolve: neon.resolve },
  { provider: 'npm', keyPattern: /^(NPM_TOKEN|NODE_AUTH_TOKEN)$/i, resolve: npm.resolve },
  { provider: 'gcloud', keyPattern: /^(GOOGLE_APPLICATION_CREDENTIALS|GCP_SERVICE_ACCOUNT(_KEY)?|GOOGLE_CREDENTIALS)$/i, resolve: gcloud.resolve },
  { provider: 'apple', keyPattern: /^APPLE_KEY_ID$/i, resolve: apple.resolveKeyId },
  { provider: 'apple', keyPattern: /^APPLE_ISSUER_ID$/i, resolve: apple.resolveIssuerId },
  { provider: 'apple', keyPattern: /^APPLE_TEAM_ID$/i, resolve: apple.resolveTeamId },
  { provider: 'apple', keyPattern: /^APPLE_(NOTARY|API|PRIVATE)_KEY(_P8)?$/i, resolve: apple.resolveP8Key },
];

export function matchProvider(keyName: string): ProviderEntry | undefined {
  return PROVIDERS.find(p => p.keyPattern.test(keyName));
}
