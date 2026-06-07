import fs from 'fs';
import path from 'path';
import { signContent, encryptAES } from '../utils/crypto.js';
import { buildYamlManifest, buildChecklistMarkdown, buildReferenceOnly } from './formatter.js';
import type { ExportOptions, ExportResult, ManifestFormat, CheckResult } from '../types/index.js';

export function buildManifestData(checkResult: CheckResult): Record<string, unknown> {
  return {
    project: checkResult.project,
    environment: checkResult.environment,
    timestamp: checkResult.timestamp,
    status: checkResult.status,
    assets: {
      summary: checkResult.assets,
      environment_variables: checkResult.categories.environmentVariables.map(a => ({
        name: a.name,
        location: a.location,
        status: a.status,
      })),
      payment_platforms: checkResult.categories.paymentPlatforms.map(p => ({
        platform: p.platform,
        status: p.status,
        webhook: p.webhook,
        api_key_age_days: p.apiKeyAgeDays,
      })),
    },
    risks: checkResult.risks,
  };
}

export function exportManifest(checkResult: CheckResult, options: ExportOptions): ExportResult {
  const timestamp = new Date().toISOString();
  const data = buildManifestData(checkResult);

  let baseContent: string;
  switch (options.format) {
    case 'checklist':
      baseContent = buildChecklistMarkdown(data);
      break;
    case 'reference-only':
      baseContent = buildReferenceOnly(data);
      break;
    default:
      baseContent = buildYamlManifest(data);
  }

  const signature = signContent(baseContent, timestamp);

  let finalContent: string;
  if (options.format === 'manifest') {
    finalContent = buildYamlManifest({
      ...data,
      signature: { algorithm: 'hmac-sha256', value: signature, timestamp },
    });
  } else {
    finalContent = baseContent;
  }

  const autoDecision = assessEncryptionNeed(checkResult, options);

  let encrypted = false;
  if (options.encrypt && options.encryptFor) {
    finalContent = encryptAES(finalContent, options.encryptFor);
    encrypted = true;
  }

  let outputPath: string | undefined;
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, finalContent, 'utf-8');
    outputPath = options.outputPath;
  }

  return { content: finalContent, format: options.format, signature, timestamp, encrypted, outputPath, autoDecision };
}

function assessEncryptionNeed(checkResult: CheckResult, options: ExportOptions): ExportResult['autoDecision'] {
  if (options.encrypt !== undefined) {
    return { encryptionRecommended: options.encrypt };
  }
  const isProduction = options.environment === 'production';
  const hasCritical = checkResult.risks.some(r => r.level === 'critical');
  if (isProduction) {
    return {
      encryptionRecommended: true,
      reason: 'production environment manifest should be encrypted',
      riskLevel: hasCritical ? 'critical' : 'high',
    };
  }
  return { encryptionRecommended: false };
}

export function generateOutputPath(project: string, environment: string, format: ManifestFormat): string {
  const ext = format === 'manifest' ? 'yml' : 'md';
  const filename = `${project}-${environment}-${new Date().toISOString().split('T')[0]}.${ext}`;
  return path.join(process.cwd(), filename);
}
