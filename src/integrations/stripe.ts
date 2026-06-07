import type { PaymentStatus, WebhookStatus, RiskItem } from '../types/index.js';

interface StripeWebhookEndpoint {
  id: string;
  url: string;
  status: string;
  enabled_events: string[];
  livemode: boolean;
}

export async function checkStripeStatus(projectId: string, apiKey?: string): Promise<PaymentStatus> {
  if (!apiKey) {
    return {
      platform: 'stripe',
      status: 'unconfigured',
      risks: [{
        level: 'medium',
        asset: 'STRIPE_SECRET_KEY',
        message: 'Stripe secret key not configured',
        suggestion: 'Add STRIPE_SECRET_KEY to your .env file',
      }],
    };
  }

  if (!apiKey.startsWith('sk_')) {
    return {
      platform: 'stripe',
      status: 'critical',
      risks: [{
        level: 'high',
        asset: 'STRIPE_SECRET_KEY',
        message: 'STRIPE_SECRET_KEY format invalid — expected sk_live_... or sk_test_...',
        suggestion: 'Verify the key is a valid Stripe secret key',
      }],
    };
  }

  const isLiveKey = apiKey.startsWith('sk_live_');

  try {
    const response = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=10', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        platform: 'stripe',
        status: 'critical',
        risks: [{
          level: 'high',
          asset: 'STRIPE_SECRET_KEY',
          message: `Stripe API returned ${response.status} — key may be invalid or restricted`,
          suggestion: 'Verify STRIPE_SECRET_KEY has the required permissions in Stripe dashboard',
        }],
      };
    }

    const data = await response.json() as { data: StripeWebhookEndpoint[] };
    const webhooks = data.data ?? [];
    const activeWebhook = webhooks.find(w => w.status === 'enabled');
    const webhookStatus = buildWebhookStatus(activeWebhook);
    const keyTruncated = isLiveKey && apiKey.length < 32;
    const risks = assessStripeRisks(webhookStatus, isLiveKey, keyTruncated);

    return {
      platform: 'stripe',
      status: risks.some(r => r.level === 'critical') ? 'critical' : risks.some(r => r.level === 'high') ? 'warning' : 'healthy',
      webhook: webhookStatus,
      risks,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      platform: 'stripe',
      status: 'critical',
      risks: [{
        level: 'medium',
        asset: 'STRIPE_SECRET_KEY',
        message: `Could not reach Stripe API: ${message}`,
        suggestion: 'Check network connectivity and API key validity',
      }],
    };
  }
}

function buildWebhookStatus(webhook?: StripeWebhookEndpoint): WebhookStatus {
  if (!webhook) return { registered: false, verified: false, lastDelivery: null, failures7d: 0 };
  return {
    registered: true,
    verified: webhook.status === 'enabled',
    url: webhook.url,
  };
}

function assessStripeRisks(webhook: WebhookStatus, isLiveKey: boolean, keyTruncated: boolean): RiskItem[] {
  const risks: RiskItem[] = [];

  if (!webhook.registered) {
    risks.push({
      level: 'high' as const,
      asset: 'STRIPE_WEBHOOK',
      message: 'No Stripe webhook endpoint registered',
      suggestion: 'Register a webhook endpoint in your Stripe dashboard',
    });
  } else if (!webhook.verified) {
    risks.push({
      level: 'medium' as const,
      asset: 'STRIPE_WEBHOOK',
      message: 'Stripe webhook endpoint disabled',
      suggestion: 'Re-enable the webhook endpoint in Stripe dashboard',
    });
  }

  if (isLiveKey && keyTruncated) {
    risks.push({
      level: 'medium' as const,
      asset: 'STRIPE_SECRET_KEY',
      message: 'Live Stripe key appears truncated',
      suggestion: 'Verify the full key was copied correctly',
    });
  }

  return risks;
}
