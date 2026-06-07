import { describe, it, expect } from 'vitest';
import { validateAssets } from '../../src/core/validator.js';
import type { Asset } from '../../src/types/index.js';

function asset(name: string, status: Asset['status'], environment?: Asset['environment']): Asset {
  return { projectId: 'p', name, location: '.env.example:1', status, environment, lastSeen: new Date().toISOString() };
}

describe('validateAssets — two-tier missing severity', () => {
  it('sensitive missing key is high (non-prod)', () => {
    const result = validateAssets([asset('STRIPE_SECRET_KEY', 'missing')], 'p');
    const risk = result.risks.find(r => r.asset === 'STRIPE_SECRET_KEY');
    expect(risk?.level).toBe('high');
  });

  it('sensitive missing key escalates to critical in production', () => {
    const result = validateAssets([asset('AUTH_TOKEN_KEY', 'missing')], 'p', 'production');
    const risk = result.risks.find(r => r.asset === 'AUTH_TOKEN_KEY');
    expect(risk?.level).toBe('critical');
    expect(result.status).toBe('critical');
  });

  it('non-sensitive config missing key is low and does not break health', () => {
    const result = validateAssets([asset('APP_NAME', 'missing')], 'p', 'production');
    const risk = result.risks.find(r => r.asset === 'APP_NAME');
    expect(risk?.level).toBe('low');
    expect(result.status).toBe('healthy');
  });

  it('mixed: only sensitive missing drives status', () => {
    const result = validateAssets([
      asset('API_TIMEOUT', 'missing'),
      asset('FEATURE_FLAG', 'missing'),
      asset('DATABASE_PASSWORD', 'missing'),
    ], 'p', 'production');
    expect(result.status).toBe('critical');
    expect(result.risks.filter(r => r.level === 'low')).toHaveLength(2);
    expect(result.risks.filter(r => r.level === 'critical')).toHaveLength(1);
  });
});
