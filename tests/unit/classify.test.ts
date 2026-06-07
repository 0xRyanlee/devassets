import { describe, it, expect } from 'vitest';
import { classifyKey, isSensitiveKey } from '../../src/utils/constants.js';

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
