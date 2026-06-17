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
