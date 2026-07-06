import path from 'path';
import os from 'os';

export const DEVASSETS_DIR = path.join(os.homedir(), '.devassets');
export const DB_PATH = path.join(DEVASSETS_DIR, 'devassets.db');
export const SIGNATURE_KEY_PATH = path.join(DEVASSETS_DIR, 'signature.key');
export const PERMISSIONS_PATH = path.join(DEVASSETS_DIR, 'permissions.yml');

export const ENV_FILE_PATTERNS = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.staging',
  '.env.production',
  '.env.test',
];

// Declaration files: list required keys, not actual values. Used to detect missing keys.
export const EXAMPLE_FILE_PATTERNS = [
  '.env.example',
  '.env.sample',
  '.env.template',
];

export type KeySensitivity = 'public' | 'secret' | 'identifier' | 'config';

// Prefixes that frameworks expose to the client bundle — public by design, never a secret
const PUBLIC_PREFIX = /^(NEXT_PUBLIC_|PUBLIC_|VITE_|EXPO_PUBLIC_|REACT_APP_|GATSBY_)/i;
// Connection strings carry an embedded password even though the name says neither KEY nor SECRET
const EMBEDDED_SECRET = /(DATABASE_URL|DIRECT_URL|_DSN$|^DSN$|CONNECTION_STRING)/i;
// Real server-side secrets
const SECRET = /(SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE_KEY|SERVICE_ROLE|ACCESS_TOKEN|API_?KEY|_TOKEN$|TOKEN_KEY|_KEY$)/i;
// Non-sensitive identifiers / references
const IDENTIFIER = /(_CLIENT_ID$|_PRICE_ID$|_PRODUCT_ID$|_SELLER_ID$|_TEAM_ID$|_LIFF_ID$|_PROJECT_ID$|_APP_ID$|_ACCOUNT_ID$|_ID$)/i;

// Classify a credential key NAME by sensitivity. Order is significant: public prefix wins over all.
export function classifyKey(name: string): KeySensitivity {
  if (PUBLIC_PREFIX.test(name)) return 'public';
  if (EMBEDDED_SECRET.test(name)) return 'secret';
  if (SECRET.test(name)) return 'secret';
  if (IDENTIFIER.test(name)) return 'identifier';
  return 'config';
}

export function isSensitiveKey(name: string): boolean {
  return classifyKey(name) === 'secret';
}

// Known account/platform-level credentials: the same value is valid across every
// project that uses that provider, because it authenticates to a shared account,
// not to one application. Safe default candidates for `_global`.
const GLOBAL_CANDIDATE_KEYS = new Set([
  'VERCEL_TOKEN', 'NPM_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN',
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY',
  'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID',
  'PADDLE_API_KEY', 'SUPABASE_ACCESS_TOKEN',
  'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
]);

// Patterns that are almost always one application's own identity or data, not a
// shared account credential: a database connection, a signing key, a JWT/session
// secret, a webhook secret bound to one endpoint. Storing these under `_global`
// leaks them into every other project via the get/inject fallback chain
// (primary → _global → other projects) — one app's signing key showing up in
// another app's environment is a real incident waiting to happen, not a
// hypothetical.
const PROJECT_ONLY_PATTERN = /(DATABASE_URL|DIRECT_URL|_KEYSTORE|SIGNING_PRIVATE_KEY|JWT_|SESSION_SECRET|COOKIE_SECRET|WEBHOOK_SECRET|TOTP_|_ANON_KEY$|SERVICE_ROLE_KEY)/i;

export type ScopeSuggestion = 'global' | 'project-only' | 'either';

// Advisory only — never blocks a `set`, callers decide what to do with the hint.
// Default posture is project scope; `_global` is the deliberate exception for
// credentials that authenticate to a shared account/platform, not credentials
// that ARE an application's own identity or data.
export function suggestScope(name: string): ScopeSuggestion {
  const upper = name.toUpperCase();
  if (GLOBAL_CANDIDATE_KEYS.has(upper)) return 'global';
  if (PROJECT_ONLY_PATTERN.test(name)) return 'project-only';
  return 'either';
}

export const PAYMENT_PLATFORM_KEY_PATTERNS: Record<string, RegExp[]> = {
  paddle: [/^PADDLE_/i],
  stripe: [/^STRIPE_/i],
  apple_iap: [/^APPLE_/i, /^IAP_/i],
  google_play: [/^GOOGLE_PLAY_/i, /^ANDROID_/i],
};

export const API_KEY_ROTATION_THRESHOLD_DAYS = 90;
export const API_KEY_WARNING_THRESHOLD_DAYS = 60;

export const DEFAULT_UI_PORT = 9090;

export const DEFAULT_ENV = 'local';
