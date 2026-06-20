import crypto from 'crypto';
import type { ResolvedIdentity } from '../../types/index.js';

const APPLE_KEY_ID_RE = /^[A-Z0-9]{10}$/;
const APPLE_TEAM_ID_RE = /^[A-Z0-9]{10}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveKeyId(value: string): Promise<ResolvedIdentity> {
  if (!APPLE_KEY_ID_RE.test(value.trim())) {
    return { provider: 'apple', valid: false, error: 'APPLE_KEY_ID must be a 10-character uppercase alphanumeric string' };
  }
  return { provider: 'apple', valid: true, account: value.trim() };
}

export async function resolveIssuerId(value: string): Promise<ResolvedIdentity> {
  if (!UUID_RE.test(value.trim())) {
    return { provider: 'apple', valid: false, error: 'APPLE_ISSUER_ID must be a UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)' };
  }
  return { provider: 'apple', valid: true };
}

export async function resolveTeamId(value: string): Promise<ResolvedIdentity> {
  if (!APPLE_TEAM_ID_RE.test(value.trim())) {
    return { provider: 'apple', valid: false, error: 'APPLE_TEAM_ID must be a 10-character uppercase alphanumeric string' };
  }
  return { provider: 'apple', valid: true, workspace: value.trim() };
}

// Resolves a .p8 private key (PEM or base64-encoded PEM).
// Validates PEM format; if APPLE_KEY_ID + APPLE_ISSUER_ID are in process.env,
// attempts a readonly App Store Connect API call to confirm the key is valid.
export async function resolveP8Key(value: string): Promise<ResolvedIdentity> {
  const pem = decodePem(value);
  if (!pem) {
    return { provider: 'apple', valid: false, error: 'Value is not a valid PKCS#8 PEM private key' };
  }

  const keyId = process.env.APPLE_KEY_ID?.trim();
  const issuerId = process.env.APPLE_ISSUER_ID?.trim();

  if (!keyId || !issuerId) {
    // PEM is structurally valid; cannot verify against API without key ID and issuer
    return {
      provider: 'apple',
      valid: true,
      account: keyId,
      workspace: process.env.APPLE_TEAM_ID?.trim(),
    };
  }

  try {
    const token = signAppStoreJwt(pem, keyId, issuerId);
    const res = await fetch('https://api.appstoreconnect.apple.com/v1/bundleIds?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { provider: 'apple', valid: false, error: `App Store Connect API ${res.status} — key invalid or expired` };
    }
    return {
      provider: 'apple',
      valid: true,
      account: keyId,
      workspace: process.env.APPLE_TEAM_ID?.trim() ?? issuerId,
    };
  } catch (err) {
    return { provider: 'apple', valid: false, error: err instanceof Error ? err.message : 'App Store Connect API unreachable' };
  }
}

function decodePem(value: string): string | null {
  // Direct PEM
  if (value.includes('-----BEGIN')) return value;
  // base64-encoded PEM
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf-8');
    if (decoded.includes('-----BEGIN')) return decoded;
  } catch { /* invalid base64 */ }
  return null;
}

function signAppStoreJwt(pem: string, keyId: string, issuerId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuerId, iat: now, exp: now + 300, aud: 'appstoreconnect-v1' })).toString('base64url');
  const data = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  // ieee-p1363 encodes r||s directly (64 bytes) instead of DER ASN.1 — required by JWT ES256
  const sig = sign.sign({ key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${data}.${sig}`;
}
