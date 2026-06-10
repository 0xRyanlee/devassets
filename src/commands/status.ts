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
    logger.info('No projects registered. Quick start:');
    logger.raw('  devassets init                             # one-time setup + security notes');
    logger.raw('  devassets add-project <name> --path=<dir> # register a project');
    logger.raw('  devassets scan <name>                      # detect env vars');
    logger.raw('  devassets set <name> <KEY>                 # store secrets encrypted');
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

    const needsAttention = missingCount > 0 || !identityOk || assets.length === 0;

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

  // ── Box-drawing helpers (rounded-corner style) ──────────────────────────
  const cw = {
    name:     Math.max('PROJECT'.length,  ...rows.map(r => r.name.length))     + 2,
    type:     Math.max('TYPE'.length,     ...rows.map(r => r.type.length))     + 2,
    vault:    Math.max('VAULT'.length,    ...rows.map(r => r.vault.length))    + 2,
    assets:   Math.max('ASSETS'.length,   ...rows.map(r => r.assets.length))   + 2,
    identity: Math.max('IDENTITY'.length, ...rows.map(r => r.identity.length)) + 2,
    ago:      Math.max('SCANNED'.length,  7)                                   + 2,
  };
  const ws = Object.values(cw);
  const pad = (s: string, w: number) => ` ${s}`.padEnd(w);
  const topLine  = () => '╭' + ws.map(w => '─'.repeat(w)).join('┬') + '╮';
  const midLine  = () => '├' + ws.map(w => '─'.repeat(w)).join('┼') + '┤';
  const botLine  = () => '╰' + ws.map(w => '─'.repeat(w)).join('┴') + '╯';
  const rowLine  = (...cells: string[]) => '│' + cells.join('│') + '│';

  logger.raw('');
  logger.raw(topLine());
  logger.raw(rowLine(
    chalk.bold(pad('PROJECT',  cw.name)),
    chalk.bold(pad('TYPE',     cw.type)),
    chalk.bold(pad('VAULT',    cw.vault)),
    chalk.bold(pad('ASSETS',   cw.assets)),
    chalk.bold(pad('IDENTITY', cw.identity)),
    chalk.bold(pad('SCANNED',  cw.ago)),
  ));
  logger.raw(midLine());

  for (const r of rows) {
    const namePlain     = pad(r.name,     cw.name);
    const typePlain     = pad(r.type,     cw.type);
    const vaultPlain    = pad(r.vault,    cw.vault);
    const assetsPlain   = pad(r.assets,   cw.assets);
    const identityPlain = pad(r.identity, cw.identity);
    const agoPlain      = pad(r.ago,      cw.ago);

    const nameC = r.needsAttention ? chalk.yellow(namePlain) : namePlain;
    const typeC = chalk.dim(typePlain);
    const vaultC = r.vaultCount === 0 ? chalk.dim(vaultPlain) : chalk.cyan(vaultPlain);
    const assetsC = r.assets === 'unscanned'
      ? chalk.dim(assetsPlain)
      : r.assetMissing > 0 ? chalk.yellow(assetsPlain) : chalk.green(assetsPlain);
    const identityC = r.identity === '—'
      ? chalk.dim(identityPlain)
      : r.identityOk
        ? (r.identity.startsWith('✓') ? chalk.green(identityPlain) : chalk.dim(identityPlain))
        : chalk.yellow(identityPlain);
    const agoC = chalk.dim(agoPlain);

    logger.raw(rowLine(nameC, typeC, vaultC, assetsC, identityC, agoC));
  }

  logger.raw(botLine());

  // Summary line
  const total = rows.length;
  const totalSecrets = rows.reduce((s, r) => s + r.vaultCount, 0);
  const warnings = rows.filter(r => r.assetMissing > 0).length;
  const mismatches = rows.filter(r => !r.identityOk).length;
  const unscanned = rows.filter(r => r.assets === 'unscanned').length;

  let summary = `  ${total} project${total !== 1 ? 's' : ''} · ${totalSecrets} secret${totalSecrets !== 1 ? 's' : ''}`;
  if (unscanned > 0) summary += ` · ${chalk.dim(`${unscanned} unscanned`)}`;
  if (warnings > 0) summary += ` · ${chalk.yellow(`${warnings} ⚠ asset warning${warnings !== 1 ? 's' : ''}`)}`;
  if (mismatches > 0) summary += ` · ${chalk.yellow(`${mismatches} ⚠ identity issue${mismatches !== 1 ? 's' : ''}`)}`;
  logger.raw(summary);

  const attention = rows.filter(r => r.needsAttention);
  if (attention.length > 0) {
    interface IssueRow { project: string; issue: string; why: string; action: string; }
    const issueRows: IssueRow[] = [];
    for (const r of attention) {
      if (r.assets === 'unscanned') {
        issueRows.push({ project: r.name, issue: 'unscanned', why: 'scan never run', action: `devassets scan ${r.id}` });
      } else if (r.assetMissing > 0) {
        issueRows.push({ project: r.name, issue: `${r.assetMissing} missing secret${r.assetMissing > 1 ? 's' : ''}`, why: 'in .env.example but not in .env', action: `devassets check ${r.id}` });
      }
      if (!r.identityOk) {
        const why = r.identity.startsWith('⚠') ? 'token belongs to wrong account' : 'token expired or revoked';
        issueRows.push({ project: r.name, issue: r.identity.trim(), why, action: `devassets identity ${r.id}` });
      }
    }

    const acw = {
      project: Math.max('PROJECT'.length, ...issueRows.map(r => r.project.length)) + 2,
      issue:   Math.max('ISSUE'.length,   ...issueRows.map(r => r.issue.length))   + 2,
      why:     Math.max('WHY'.length,     ...issueRows.map(r => r.why.length))     + 2,
      action:  Math.max('ACTION'.length,  ...issueRows.map(r => r.action.length))  + 2,
    };
    const aws = Object.values(acw);
    const atop = () => '╭' + aws.map(w => '─'.repeat(w)).join('┬') + '╮';
    const amid = () => '├' + aws.map(w => '─'.repeat(w)).join('┼') + '┤';
    const abot = () => '╰' + aws.map(w => '─'.repeat(w)).join('┴') + '╯';
    const arow = (...cells: string[]) => '│' + cells.join('│') + '│';

    logger.raw('');
    logger.raw(atop());
    logger.raw(arow(
      chalk.bold(pad('PROJECT', acw.project)),
      chalk.bold(pad('ISSUE',   acw.issue)),
      chalk.bold(pad('WHY',     acw.why)),
      chalk.bold(pad('ACTION',  acw.action)),
    ));
    logger.raw(amid());
    for (const ir of issueRows) {
      logger.raw(arow(
        chalk.yellow(pad(ir.project, acw.project)),
        chalk.yellow(pad(ir.issue,   acw.issue)),
        chalk.dim(pad(ir.why,        acw.why)),
        chalk.cyan(pad(ir.action,    acw.action)),
      ));
    }
    logger.raw(abot());
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
