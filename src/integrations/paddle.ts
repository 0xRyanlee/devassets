import type { PaymentStatus, WebhookStatus, RiskItem } from '../types/index.js';

interface PaddleWebhook {
  url: string;
  status: string;
  last_delivery?: string;
  failures_7d?: number;
}

export async function checkPaddleStatus(projectId: string, apiKey?: string): Promise<PaymentStatus> {
  if (!apiKey) {
    return {
      platform: 'paddle',
      status: 'unconfigured',
      risks: [{
        level: 'medium',
        asset: 'PADDLE_API_KEY',
        message: 'Paddle API key not configured',
        suggestion: 'Add PADDLE_API_KEY to your .env file',
      }],
    };
  }

  try {
    const response = await fetch('https://api.paddle.com/webhooks', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        platform: 'paddle',
        status: 'critical' as const,
        risks: [{
          level: 'high' as const,
          asset: 'PADDLE_API_KEY',
          message: `Paddle API returned ${response.status} — key may be invalid or expired`,
          suggestion: 'Verify PADDLE_API_KEY is correct and has the required permissions',
        }],
      };
    }

    const data = await response.json() as { data: PaddleWebhook[] };
    const webhook = data.data?.[0];
    const webhookStatus = buildWebhookStatus(webhook);
    const risks = assessPaddleRisks(webhookStatus);

    return {
      platform: 'paddle',
      status: risks.some(r => r.level === 'critical') ? 'critical' : risks.some(r => r.level === 'high') ? 'warning' : 'healthy',
      webhook: webhookStatus,
      risks,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      platform: 'paddle',
      status: 'critical' as const,
      risks: [{
        level: 'medium' as const,
        asset: 'PADDLE_API_KEY',
        message: `Could not reach Paddle API: ${message}`,
        suggestion: 'Check network connectivity and API key validity',
      }],
    };
  }
}

function buildWebhookStatus(webhook?: PaddleWebhook): WebhookStatus {
  if (!webhook) return { registered: false, verified: false, lastDelivery: null, failures7d: 0 };
  return {
    registered: true,
    verified: webhook.status === 'active',
    lastDelivery: webhook.last_delivery ?? null,
    failures7d: webhook.failures_7d ?? 0,
    url: webhook.url,
  };
}

function assessPaddleRisks(webhook: WebhookStatus): RiskItem[] {
  const risks: RiskItem[] = [];

  if (!webhook.registered) {
    risks.push({
      level: 'high' as const,
      asset: 'PADDLE_WEBHOOK',
      message: 'Paddle webhook not registered',
      suggestion: 'Register a webhook endpoint in your Paddle dashboard',
    });
  } else if (!webhook.verified) {
    risks.push({
      level: 'medium' as const,
      asset: 'PADDLE_WEBHOOK',
      message: 'Paddle webhook registered but not verified active',
      suggestion: 'Check webhook status in Paddle dashboard and verify the endpoint URL',
    });
  }

  if (webhook.failures7d && webhook.failures7d > 5) {
    risks.push({
      level: 'high' as const,
      asset: 'PADDLE_WEBHOOK',
      message: `Paddle webhook had ${webhook.failures7d} failures in last 7 days`,
      suggestion: 'Investigate webhook endpoint logs for errors',
    });
  }

  return risks;
}
