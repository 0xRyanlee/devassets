import chalk from 'chalk';
import { listProjects } from '../db/queries.js';
import { listVaultSecrets, getCredentialIdentities, getAssets } from '../db/queries.js';
import { logger } from '../utils/logger.js';

interface StatusOptions {
  json?: boolean;
}

interface ProjectRow {
  id: string;
  name: string;
  type: string;
  vault: string;
  vaultCount: number;
  assets: string;
  assetMissing: number;
  identity: string;
  identityOk: boolean;
  ago: string;
  needsAttention: boolean;
}

export function statusCommand(options: StatusOptions) {
  const projects = listProjects();

  if (projects.length === 0) {
    logger.info('No projects registered.');
    logger.raw('  Run: devassets add-project <name> --path=<path>');
    return;
  }

  const rows: ProjectRow[] = projects.map(p => {
    const secrets = listVaultSecrets(p.id);
    const assets = getAssets(p.id);
    const identities = getCredentialIdentities(p.id);

    // Vault column: "local:5 · staging:2" or "—"
    const envCounts = new Map<string, number>();
    for (const s of secrets) {
      envCounts.set(s.env, (envCounts.get(s.env) ?? 0) + 1);
    }
    const vaultStr = envCounts.size === 0
      ? '—'
      : [...envCounts.entries()].map(([e, n]) => `${e}:${n}`).join(' · ');

    // Assets column: "12 vars · 0 miss" or "unscanned"
    const missingCount = assets.filter(a => a.status === 'missing' || a.status === 'error').length;
    const assetsStr = assets.length === 0
      ? 'unscanned'
      : `${assets.length} vars · ${missingCount} miss`;

    // Identity column: "✓ 3 pinned" / "⚠ mismatch" / "✗ N invalid" / "—"
    let identityStr = '—';
    let identityOk = true;
    if (identities.length > 0) {
      const mismatches = identities.filter(i => i.mismatch);
      const invalids = identities.filter(i => !i.valid);
      const pinned = identities.filter(i => i.expectedAccount || i.expectedWorkspace);
      if (mismatches.length > 0) {
        identityStr = `⚠ ${mismatches.length} mismatch`;
        identityOk = false;
      } else if (invalids.length > 0) {
        identityStr = `✗ ${invalids.length} invalid`;
        identityOk = false;
      } else if (pinned.length === identities.length) {
        identityStr = `✓ ${identities.length} pinned`;
      } else {
        identityStr = `~ ${identities.length} checked`;
      }
    }

    // Last scan: relative time from max lastSeen
    const lastSeens = assets.map(a => new Date(a.lastSeen).getTime()).filter(t => !isNaN(t));
    const ago = lastSeens.length === 0 ? '—' : relativeTime(Math.max(...lastSeens));

    const needsAttention = missingCount > 0 || !identityOk || secrets.length === 0 || assets.length === 0;

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      vault: vaultStr,
      vaultCount: secrets.length,
      assets: assetsStr,
      assetMissing: missingCount,
      identity: identityStr,
      identityOk,
      ago,
      needsAttention,
    };
  });

  if (options.json) {
    logger.raw(JSON.stringify(rows.map(r => ({
      project: r.name,
      type: r.type,
      vault: r.vault,
      vaultCount: r.vaultCount,
      assets: r.assets,
      assetMissing: r.assetMissing,
      identity: r.identity,
      ago: r.ago,
    })), null, 2));
    return;
  }

  // Column widths (dynamic)
  const nameW = Math.max(10, ...rows.map(r => r.name.length)) + 2;
  const typeW = 8;
  const vaultW = Math.max(10, ...rows.map(r => r.vault.length)) + 2;
  const assetsW = Math.max(11, ...rows.map(r => r.assets.length)) + 2;
  const identityW = Math.max(10, ...rows.map(r => r.identity.length)) + 2;
  const agoW = 7;

  const totalW = nameW + typeW + vaultW + assetsW + identityW + agoW;

  const header =
    chalk.bold('PROJECT'.padEnd(nameW)) +
    chalk.bold('TYPE'.padEnd(typeW)) +
    chalk.bold('VAULT'.padEnd(vaultW)) +
    chalk.bold('ASSETS'.padEnd(assetsW)) +
    chalk.bold('IDENTITY'.padEnd(identityW)) +
    chalk.bold('SCANNED');

  logger.raw('');
  logger.raw(header);
  logger.raw('─'.repeat(totalW));

  for (const r of rows) {
    const name = r.needsAttention
      ? chalk.yellow(r.name.padEnd(nameW))
      : r.name.padEnd(nameW);

    const type = chalk.dim(r.type.padEnd(typeW));

    const vault = r.vaultCount === 0
      ? chalk.dim(r.vault.padEnd(vaultW))
      : chalk.cyan(r.vault.padEnd(vaultW));

    const assets = r.assets === 'unscanned'
      ? chalk.dim(r.assets.padEnd(assetsW))
      : r.assetMissing > 0
        ? chalk.yellow(r.assets.padEnd(assetsW))
        : chalk.green(r.assets.padEnd(assetsW));

    const identity = r.identity === '—'
      ? chalk.dim(r.identity.padEnd(identityW))
      : r.identityOk
        ? (r.identity.startsWith('✓') ? chalk.green(r.identity.padEnd(identityW)) : chalk.dim(r.identity.padEnd(identityW)))
        : chalk.yellow(r.identity.padEnd(identityW));

    const ago = chalk.dim(r.ago.padEnd(agoW));

    logger.raw(name + type + vault + assets + identity + ago);
  }

  logger.raw('─'.repeat(totalW));

  // Summary line
  const total = rows.length;
  const totalSecrets = rows.reduce((s, r) => s + r.vaultCount, 0);
  const warnings = rows.filter(r => r.assetMissing > 0).length;
  const mismatches = rows.filter(r => !r.identityOk).length;
  const unscanned = rows.filter(r => r.assets === 'unscanned').length;

  let summary = `${total} project${total !== 1 ? 's' : ''} · ${totalSecrets} secret${totalSecrets !== 1 ? 's' : ''}`;
  if (unscanned > 0) summary += ` · ${chalk.dim(`${unscanned} unscanned`)}`;
  if (warnings > 0) summary += ` · ${chalk.yellow(`${warnings} ⚠ asset warning${warnings !== 1 ? 's' : ''}`)}`;
  if (mismatches > 0) summary += ` · ${chalk.yellow(`${mismatches} ⚠ identity issue${mismatches !== 1 ? 's' : ''}`)}`;
  logger.raw(summary);

  const attention = rows.filter(r => r.needsAttention);
  if (attention.length > 0) {
    logger.raw('');
    logger.raw(chalk.dim('Needs attention:'));
    for (const r of attention) {
      const hints: string[] = [];
      if (r.assets === 'unscanned') hints.push(`devassets scan ${r.id}`);
      else if (r.assetMissing > 0) hints.push(`devassets check ${r.id}`);
      if (!r.identityOk) hints.push(`devassets identity ${r.id}`);
      if (r.vaultCount === 0 && r.assets !== 'unscanned') hints.push(`devassets set ${r.id} <KEY>`);
      logger.raw(`  ${chalk.yellow(r.name.padEnd(nameW - 2))}  ${hints.join('  ·  ')}`);
    }
  }
  logger.raw('');
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(diff / 3600000);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(diff / 86400000);
  if (d < 14) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}
