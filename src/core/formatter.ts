import yaml from 'js-yaml';
import chalk from 'chalk';
import type { CheckResult, ExportResult } from '../types/index.js';
import { statusIcon, riskIcon } from '../utils/logger.js';

export function formatCheckHuman(result: CheckResult): string {
  const lines: string[] = [];
  const statusColor = result.status === 'healthy' ? chalk.green : result.status === 'warning' ? chalk.yellow : chalk.red;

  lines.push('');
  lines.push(chalk.bold(`Project: ${result.project}`));
  if (result.environment) lines.push(`Environment: ${result.environment}`);
  lines.push(`Status: ${statusColor(result.status.toUpperCase())}`);
  lines.push('');

  const managedPart = result.assets.managed > 0 ? `, ${result.assets.managed} managed` : '';
  lines.push(chalk.bold(`Assets (${result.assets.configured} configured, ${result.assets.missing} missing, ${result.assets.errors} errors${managedPart}):`));
  for (const a of result.categories.environmentVariables) {
    lines.push(`  ${statusIcon(a.status)} ${a.name.padEnd(40)} ${chalk.gray(a.location)}`);
  }
  lines.push('');

  if (result.categories.paymentPlatforms.length > 0) {
    lines.push(chalk.bold('Payment Platforms:'));
    for (const p of result.categories.paymentPlatforms) {
      lines.push(`  ${statusIcon(p.status)} ${p.platform}`);
      if (p.webhook && !p.webhook.verified) {
        lines.push(`    ${chalk.yellow('Webhook not verified')}`);
      }
      if (p.apiKeyAgeDays) {
        lines.push(`    API key age: ${p.apiKeyAgeDays} days`);
      }
    }
    lines.push('');
  }

  if (result.risks.length > 0) {
    lines.push(chalk.bold('Risks:'));
    for (const r of result.risks) {
      lines.push(`  ${riskIcon(r.level)} ${r.message}`);
    }
    lines.push('');
  }

  if (result.suggestions.length > 0) {
    lines.push(chalk.bold('Suggestions:'));
    result.suggestions.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export function formatCheckJson(result: CheckResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatExportHuman(result: ExportResult): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold('Export complete'));
  lines.push(`Format:    ${result.format}`);
  lines.push(`Encrypted: ${result.encrypted ? chalk.green('yes') : chalk.gray('no')}`);
  lines.push(`Signature: ${chalk.gray(result.signature.slice(0, 16) + '...')}`);
  if (result.outputPath) lines.push(`Saved to:  ${result.outputPath}`);

  if (result.autoDecision.encryptionRecommended && !result.encrypted) {
    lines.push('');
    lines.push(chalk.yellow(`⚠ Encryption recommended: ${result.autoDecision.reason}`));
    lines.push(chalk.yellow('  Re-run with --encrypt to encrypt this manifest'));
  }
  lines.push('');
  return lines.join('\n');
}

export function buildYamlManifest(data: Record<string, unknown>): string {
  return yaml.dump(data, { lineWidth: 120, noRefs: true });
}

export function buildChecklistMarkdown(data: Record<string, unknown>): string {
  const lines: string[] = ['# DevAssets Checklist', ''];
  const project = data['project'] as string;
  const env = data['environment'] as string;
  const timestamp = data['timestamp'] as string;

  lines.push(`**Project**: ${project}`);
  lines.push(`**Environment**: ${env}`);
  lines.push(`**Generated**: ${timestamp}`);
  lines.push('');

  const assetData = data['assets'] as Record<string, unknown>;
  if (assetData) {
    lines.push('## Environment Variables');
    lines.push('');
    const envVars = assetData['environment_variables'] as Array<{ name: string; status: string; location: string }>;
    if (envVars) {
      for (const v of envVars) {
        const check = v.status === 'configured' ? '- [x]' : '- [ ]';
        lines.push(`${check} \`${v.name}\` — ${v.location}`);
      }
    }
    lines.push('');
  }

  const risks = data['risks'] as Array<{ level: string; asset: string; message: string }>;
  if (risks && risks.length > 0) {
    lines.push('## Risks');
    lines.push('');
    for (const r of risks) {
      lines.push(`- **[${r.level.toUpperCase()}]** ${r.message}`);
    }
    lines.push('');
  }

  const sig = data['signature'] as Record<string, string>;
  if (sig) {
    lines.push('---');
    lines.push(`*Signed: ${sig['value']?.slice(0, 16)}...*`);
  }

  return lines.join('\n');
}

export function buildReferenceOnly(data: Record<string, unknown>): string {
  const lines: string[] = ['# DevAssets Reference', ''];
  const assetData = data['assets'] as Record<string, unknown>;

  if (assetData) {
    const envVars = assetData['environment_variables'] as Array<{ name: string; location: string }>;
    if (envVars) {
      lines.push('## Required Environment Variables');
      lines.push('');
      for (const v of envVars) {
        lines.push(`- \`${v.name}\` (${v.location})`);
      }
    }
  }

  return lines.join('\n');
}
