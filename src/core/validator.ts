import type { Asset, RiskItem, RiskLevel, CheckResult, PaymentStatus } from '../types/index.js';
import { API_KEY_ROTATION_THRESHOLD_DAYS, API_KEY_WARNING_THRESHOLD_DAYS, classifyKey } from '../utils/constants.js';

export function validateAssets(assets: Asset[], projectId: string, environment?: string): CheckResult {
  const now = new Date().toISOString();
  const filtered = environment ? assets.filter(a => !a.environment || a.environment === environment) : assets;

  const missing = filtered.filter(a => a.status === 'missing');
  const errors = filtered.filter(a => a.status === 'error');
  const configured = filtered.filter(a => a.status === 'configured');
  const managed = filtered.filter(a => a.status === 'managed');

  const risks: RiskItem[] = [];

  for (const asset of missing) {
    const isProd = environment === 'production' || asset.environment === 'production';
    const sensitivity = classifyKey(asset.name);
    const level: RiskLevel = sensitivity === 'secret' ? (isProd ? 'critical' : 'high') : 'low';
    const kindLabel =
      sensitivity === 'public' ? 'public config' :
      sensitivity === 'identifier' ? 'identifier' :
      sensitivity === 'config' ? 'optional config' : 'secret';
    risks.push({
      level,
      asset: asset.name,
      message: sensitivity === 'secret'
        ? `${asset.name} is missing${environment ? ` in ${environment}` : ''}`
        : `${asset.name} declared in example but not set (${kindLabel})`,
      suggestion: `Add ${asset.name} to ${asset.location.split(':')[0].replace(/\.example|\.sample|\.template/, '')}`,
    });
  }

  for (const asset of errors) {
    risks.push({
      level: 'high',
      asset: asset.name,
      message: `${asset.name} has configuration error`,
    });
  }

  const criticalCount = risks.filter(r => r.level === 'critical').length;
  const highCount = risks.filter(r => r.level === 'high').length;
  const status = criticalCount > 0 ? 'critical' : highCount > 0 ? 'warning' : 'healthy';

  const suggestions = risks
    .filter(r => r.suggestion)
    .map(r => r.suggestion!);

  return {
    project: projectId,
    environment,
    timestamp: now,
    status,
    assets: {
      total: filtered.length,
      configured: configured.length,
      missing: missing.length,
      errors: errors.length,
      managed: managed.length,
    },
    categories: {
      environmentVariables: filtered.map(a => ({
        name: a.name,
        status: a.status,
        location: a.location,
        risk: getRiskForStatus(a.status, environment, a.name),
      })),
      paymentPlatforms: [],
    },
    risks,
    suggestions,
  };
}

function getRiskForStatus(status: string, environment?: string, name?: string): RiskLevel | undefined {
  if (status === 'missing') {
    if (name && classifyKey(name) !== 'secret') return 'low';
    return environment === 'production' ? 'critical' : 'high';
  }
  if (status === 'error') return 'high';
  if (status === 'warning') return 'medium';
  return undefined;
}

export function assessApiKeyAge(lastRotatedDays: number, keyName: string): RiskItem | null {
  if (lastRotatedDays >= API_KEY_ROTATION_THRESHOLD_DAYS) {
    return {
      level: 'high',
      asset: keyName,
      message: `API key is ${lastRotatedDays} days old — rotation overdue`,
      suggestion: `Run: devassets rotate <project> ${keyName}`,
    };
  }
  if (lastRotatedDays >= API_KEY_WARNING_THRESHOLD_DAYS) {
    return {
      level: 'medium',
      asset: keyName,
      message: `API key is ${lastRotatedDays} days old — rotation recommended`,
      suggestion: `Run: devassets rotate <project> ${keyName}`,
    };
  }
  return null;
}

export function mergePaymentRisks(result: CheckResult, paymentStatuses: PaymentStatus[]): CheckResult {
  const allRisks = [...result.risks];

  for (const ps of paymentStatuses) {
    allRisks.push(...ps.risks);
  }

  const criticalCount = allRisks.filter(r => r.level === 'critical').length;
  const highCount = allRisks.filter(r => r.level === 'high').length;
  const status = criticalCount > 0 ? 'critical' : highCount > 0 || result.status === 'warning' ? 'warning' : 'healthy';

  return {
    ...result,
    status,
    categories: {
      ...result.categories,
      paymentPlatforms: paymentStatuses,
    },
    risks: allRisks,
    suggestions: [...result.suggestions, ...paymentStatuses.flatMap(ps => ps.risks.filter(r => r.suggestion).map(r => r.suggestion!))],
  };
}
