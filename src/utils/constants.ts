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
  '.env.example',
];

export const PAYMENT_PLATFORM_KEY_PATTERNS: Record<string, RegExp[]> = {
  paddle: [/^PADDLE_/i],
  stripe: [/^STRIPE_/i],
  apple_iap: [/^APPLE_/i, /^IAP_/i],
  google_play: [/^GOOGLE_PLAY_/i, /^ANDROID_/i],
};

export const API_KEY_ROTATION_THRESHOLD_DAYS = 90;
export const API_KEY_WARNING_THRESHOLD_DAYS = 60;

export const DEFAULT_UI_PORT = 9090;
