import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkStripeStatus } from '../../src/integrations/stripe.js';

describe('checkStripeStatus', () => {
  it('returns unconfigured when no api key', async () => {
    const result = await checkStripeStatus('proj1');
    expect(result.status).toBe('unconfigured');
    expect(result.platform).toBe('stripe');
  });

  it('returns critical for invalid key format', async () => {
    const result = await checkStripeStatus('proj1', 'not_a_stripe_key');
    expect(result.status).toBe('critical');
    expect(result.risks[0].asset).toBe('STRIPE_SECRET_KEY');
  });

  it('accepts test key format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'we_1', url: 'https://example.com/webhook', status: 'enabled', enabled_events: ['*'], livemode: false }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await checkStripeStatus('proj1', 'sk_test_abc123456789012345678901');
    expect(result.platform).toBe('stripe');
    expect(result.status).toBe('healthy');
    expect(result.webhook?.registered).toBe(true);

    vi.unstubAllGlobals();
  });

  it('returns critical on non-ok API response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', mockFetch);

    const result = await checkStripeStatus('proj1', 'sk_live_validkey');
    expect(result.status).toBe('critical');

    vi.unstubAllGlobals();
  });

  it('returns critical on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await checkStripeStatus('proj1', 'sk_test_abc');
    expect(result.status).toBe('critical');
    expect(result.risks[0].message).toContain('Network failure');

    vi.unstubAllGlobals();
  });

  it('flags missing webhook as high risk', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await checkStripeStatus('proj1', 'sk_test_abc');
    const webhookRisk = result.risks.find(r => r.asset === 'STRIPE_WEBHOOK');
    expect(webhookRisk?.level).toBe('high');

    vi.unstubAllGlobals();
  });
});
