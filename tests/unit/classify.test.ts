import { describe, it, expect } from 'vitest';
import { classifyKey, isSensitiveKey, suggestScope } from '../../src/utils/constants.js';

describe('classifyKey', () => {
  it('public prefix overrides everything (even _KEY suffix)', () => {
    expect(classifyKey('NEXT_PUBLIC_SUPABASE_ANON_KEY')).toBe('public');
    expect(classifyKey('NEXT_PUBLIC_VAPID_KEY')).toBe('public');
    expect(classifyKey('NEXT_PUBLIC_GOOGLE_CLIENT_ID')).toBe('public');
    expect(classifyKey('VITE_API_URL')).toBe('public');
    expect(classifyKey('EXPO_PUBLIC_TOKEN')).toBe('public');
  });

  it('real secrets', () => {
    expect(classifyKey('GOOGLE_CLIENT_SECRET')).toBe('secret');
    expect(classifyKey('SUPABASE_SERVICE_ROLE_KEY')).toBe('secret');
    expect(classifyKey('SUPABASE_ACCESS_TOKEN')).toBe('secret');
    expect(classifyKey('VERCEL_TOKEN')).toBe('secret');
    expect(classifyKey('VAPID_PRIVATE_KEY')).toBe('secret');
    expect(classifyKey('ADMIN_PASSWORD')).toBe('secret');
    expect(classifyKey('PADDLE_WEBHOOK_SECRET')).toBe('secret');
    expect(classifyKey('GEMINI_API_KEY')).toBe('secret');
  });

  it('connection strings with embedded passwords are secret', () => {
    expect(classifyKey('DATABASE_URL')).toBe('secret');
    expect(classifyKey('DIRECT_URL')).toBe('secret');
  });

  it('identifiers are not secrets', () => {
    expect(classifyKey('GOOGLE_CLIENT_ID')).toBe('identifier');
    expect(classifyKey('PADDLE_LIFETIME_PRICE_ID')).toBe('identifier');
    expect(classifyKey('PADDLE_LIFETIME_PRODUCT_ID')).toBe('identifier');
    expect(classifyKey('PADDLE_SELLER_ID')).toBe('identifier');
    expect(classifyKey('APPLE_TEAM_ID')).toBe('identifier');
    expect(classifyKey('LINE_LIFF_ID')).toBe('identifier');
  });

  it('plain config', () => {
    expect(classifyKey('APP_NAME')).toBe('config');
    expect(classifyKey('AUTH_TOKEN_EXPIRY')).toBe('config');
    expect(classifyKey('PDF_MAX_PAGES')).toBe('config');
  });

  it('isSensitiveKey is true only for secret category', () => {
    expect(isSensitiveKey('GOOGLE_CLIENT_SECRET')).toBe(true);
    expect(isSensitiveKey('NEXT_PUBLIC_SUPABASE_ANON_KEY')).toBe(false);
    expect(isSensitiveKey('GOOGLE_CLIENT_ID')).toBe(false);
    expect(isSensitiveKey('APP_NAME')).toBe(false);
  });
});

describe('suggestScope', () => {
  it('known account/platform credentials suggest global', () => {
    expect(suggestScope('VERCEL_TOKEN')).toBe('global');
    expect(suggestScope('ANTHROPIC_API_KEY')).toBe('global');
    expect(suggestScope('CLOUDFLARE_API_TOKEN')).toBe('global');
    expect(suggestScope('CLOUDFLARE_ACCOUNT_ID')).toBe('global');
    expect(suggestScope('PADDLE_API_KEY')).toBe('global');
    expect(suggestScope('SUPABASE_ACCESS_TOKEN')).toBe('global');
    expect(suggestScope('R2_ACCESS_KEY_ID')).toBe('global');
    // case-insensitive
    expect(suggestScope('vercel_token')).toBe('global');
  });

  it('per-application secrets suggest project-only, even when they share a substring with a global key', () => {
    expect(suggestScope('DATABASE_URL')).toBe('project-only');
    expect(suggestScope('CUCKOO_TAURI_SIGNING_PRIVATE_KEY')).toBe('project-only');
    expect(suggestScope('CUCKOO_ANDROID_KEYSTORE')).toBe('project-only');
    expect(suggestScope('JWT_SECRET')).toBe('project-only');
    expect(suggestScope('IRON_SESSION_PASSWORD')).not.toBe('global');
    // same provider as a global key, but this one is endpoint-specific, not account-level
    expect(suggestScope('PADDLE_WEBHOOK_SECRET')).toBe('project-only');
    expect(suggestScope('SUPABASE_SERVICE_ROLE_KEY')).toBe('project-only');
    expect(suggestScope('NEXT_PUBLIC_SUPABASE_ANON_KEY')).toBe('project-only');
  });

  it('unrecognized keys are either — no opinion, no warning', () => {
    expect(suggestScope('APP_NAME')).toBe('either');
    expect(suggestScope('GOOGLE_CLIENT_ID')).toBe('either');
    expect(suggestScope('NEXT_PUBLIC_WORLD_APP_ID')).toBe('either');
  });
});
