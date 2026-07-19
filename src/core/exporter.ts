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
  // encrypt=true with no password used to silently fall through to a plaintext manifest (the
  // `if (options.encrypt && options.encryptFor)` check below just skipped encryption). Both CLI
  // and MCP go through this single function, so validating here covers both call sites.
  if (options.encrypt) {
    if (!options.encryptFor) {
      throw new Error('--encrypt requires --encrypt-for <password> — refusing to write an unencrypted manifest');
    }
    if (options.encryptFor.length < 8) {
      throw new Error('Encryption password must be at least 8 characters');
    }
  }

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
    // checklist and reference-only formats append signature as a comment so receivers can verify
    finalContent = baseContent + `\n<!-- devassets-signature: ${signature} ts: ${timestamp} -->`;
  }

  const autoDecision = assessEncryptionNeed(checkResult, options);

  let encrypted = false;
  if (options.encrypt && options.encryptFor) {
    finalContent = encryptAES(finalContent, options.encryptFor);
    encrypted = true;
  }

  let outputPath: string | undefined;
  if (options.outputPath) {
    const resolvedOutput = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    fs.writeFileSync(resolvedOutput, finalContent, 'utf-8');
    outputPath = resolvedOutput;
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

// project/environment can come from MCP callers (potentially prompt-injected agents), so they're
// sanitized before being interpolated into a filesystem path — an unsanitized "../../.git/hooks/x"
// environment value would otherwise write outside cwd even though output_path was never supplied.
function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function generateOutputPath(project: string, environment: string, format: ManifestFormat): string {
  const ext = format === 'manifest' ? 'yml' : 'md';
  const filename = `${safePathSegment(project)}-${safePathSegment(environment)}-${new Date().toISOString().split('T')[0]}.${ext}`;
  return path.join(process.cwd(), filename);
}
