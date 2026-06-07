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

// Keys whose absence is a real risk (secrets), vs non-sensitive config that can have code defaults
export const SENSITIVE_KEY_PATTERN = /(SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|API_?KEY|ACCESS_?KEY|_TOKEN$|TOKEN_KEY|_KEY$|_DSN$|^DSN$)/i;

export function isSensitiveKey(name: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(name);
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
