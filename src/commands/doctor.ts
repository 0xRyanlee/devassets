import chalk from 'chalk';
import fs from 'fs';
import { Listr } from 'listr2';
import { listProjects, getAssets, getPaymentPlatforms, getAuditLogs, replaceAssets, ensurePaymentPlatformDetected, addAuditLog, getCurrentUser, getVaultSecretCounts, listVaultSecrets } from '../db/queries.js';
import { validateAssets, assessApiKeyAge } from '../core/validator.js';
import { scanProject } from '../core/scanner.js';
import { logger } from '../utils/logger.js';
import { suggestScope } from '../utils/constants.js';

interface DoctorOptions {
  json?: boolean;
  fix?: boolean;
}

export interface DoctorReport {
  generatedAt: string;
  summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    globalVaultKeys: number;
  };
  projects: ProjectHealth[];
  topRisks: TopRisk[];
  recentActivity: RecentActivity[];
  crossProjectKeyReuse: KeyReuse[];
}

interface ProjectHealth {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  assetCount: number;
  missingCount: number;
  riskCount: number;
  vaultSecretCount: number;
  lastScanned?: string;
}

interface TopRisk {
  project: string;
  level: string;
  asset: string;
  message: string;
  suggestion?: string;
}

interface KeyReuse {
  key: string;
  projects: string[];
  suggestion: string;
}

interface RecentActivity {
  project: string;
  action: string;
  timestamp: string;
  result: string;
}

export async function doctorCommand(options: DoctorOptions) {
  // _global is a reserved virtual project — skip in the main loop
  const projects = listProjects().filter(p => p.id !== '_global');

  if (projects.length === 0) {
    logger.warn('No projects registered. Run: devassets add-project <name> --path=<path>');
    return;
  }

  if (options.fix) {
    const dead = await runDoctorFix(projects, !!options.json);
    const report = buildDoctorReport(listProjects());
    if (options.json) {
      console.log(JSON.stringify({ ...report, deadPaths: dead }, null, 2));
    } else {
      printDoctorReport(report);
      if (dead.length > 0) {
        console.log(chalk.yellow(`${dead.length} project(s) have missing paths: ${dead.join(', ')}`));
        console.log(chalk.gray('Re-add with the correct path: devassets add-project <name> --path=<path>'));
        console.log('');
      }
    }
    return;
  }

  const report = buildDoctorReport(projects);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printDoctorReport(report);
}

async function runDoctorFix(projects: ReturnType<typeof listProjects>, silent: boolean): Promise<string[]> {
  const dead: string[] = [];

  const tasks = new Listr(
    projects.map(p => ({
      title: `Re-scan ${p.id}`,
      task: (_ctx: unknown, task: { title: string; skip: (msg: string) => void }) => {
        if (!fs.existsSync(p.path)) {
          dead.push(p.id);
          task.skip(`${p.id}: path missing (${p.path})`);
          return;
        }
        const result = scanProject(p.id, p.path);
        replaceAssets(p.id, result.assets);
        for (const platform of result.detectedPlatforms) {
          ensurePaymentPlatformDetected(p.id, platform);
        }
        addAuditLog({ projectId: p.id, action: 'scan', user: getCurrentUser(), timestamp: result.scannedAt, details: { via: 'doctor-fix', assetsFound: result.assets.length }, result: 'success' });
        task.title = `${p.id}: ${result.assets.length} assets refreshed`;
      },
    })),
    { concurrent: false, renderer: silent ? 'silent' : 'default' }
  );

  await tasks.run();
  return dead;
}

export function buildDoctorReport(projects: ReturnType<typeof listProjects>): DoctorReport {
  // Strip _global from the project list — it's not a scannable project
  projects = projects.filter(p => p.id !== '_global');
  const now = new Date().toISOString();
  const projectHealths: ProjectHealth[] = [];
  const topRisks: TopRisk[] = [];
  const vaultCounts = getVaultSecretCounts();
  const recentLogs: RecentActivity[] = [];
  // key name -> set of project IDs that have a secret with that name (used for the cross-project
  // reuse check below — populated in the same per-project loop that already fetches vault secrets
  // for the age check, rather than a separate pass).
  const keyOwners = new Map<string, Set<string>>();

  for (const project of projects) {
    const assets = getAssets(project.id);
    const result = validateAssets(assets, project.id, undefined, project.type);
    // Single 30-day query serves both lastScanned (most recent entry) and the 7-day recent
    // activity feed (filtered in memory) — this used to be two independent queries per project.
    const logs = getAuditLogs(project.id, 30);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    projectHealths.push({
      id: project.id,
      name: project.name,
      status: result.status,
      assetCount: result.assets.total,
      missingCount: result.assets.missing,
      riskCount: result.risks.length,
      vaultSecretCount: vaultCounts[project.id] ?? 0,
      lastScanned: logs[0]?.timestamp,
    });

    let recentCount = 0;
    for (const l of logs) {
      if (Date.parse(l.timestamp) < sevenDaysAgo) break; // logs are DESC-sorted, so the rest are older still
      if (recentCount >= 3) break; // preserve the original per-project cap
      recentLogs.push({ project: project.id, action: l.action, timestamp: l.timestamp, result: l.result });
      recentCount++;
    }

    for (const risk of result.risks.slice(0, 2)) {
      topRisks.push({ project: project.id, level: risk.level, asset: risk.asset, message: risk.message });
    }

    for (const secret of listVaultSecrets(project.id)) {
      const ageDays = Math.floor((Date.now() - Date.parse(secret.updatedAt)) / 86_400_000);
      const ageRisk = assessApiKeyAge(ageDays, secret.key);
      if (ageRisk) topRisks.push({ project: project.id, level: ageRisk.level, asset: ageRisk.asset, message: ageRisk.message, suggestion: ageRisk.suggestion });

      if (!keyOwners.has(secret.key)) keyOwners.set(secret.key, new Set());
      keyOwners.get(secret.key)!.add(project.id);
    }
  }

  topRisks.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.level as keyof typeof order] ?? 4) - (order[b.level as keyof typeof order] ?? 4);
  });
  recentLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // A key name stored under 2+ distinct projects, where suggestScope doesn't consider it
  // inherently per-project (DATABASE_URL etc. are expected to repeat), is a likely candidate for
  // _global instead of being copy-pasted across projects — the exact CHANGELOG 1.15 incident.
  const crossProjectKeyReuse: KeyReuse[] = [...keyOwners.entries()]
    .filter(([key, owners]) => owners.size >= 2 && suggestScope(key) !== 'project-only')
    .map(([key, owners]) => ({
      key,
      projects: [...owners].sort(),
      suggestion: `${key} is duplicated across ${owners.size} projects — consider storing it once under _global: devassets set _global ${key}`,
    }));

  return {
    generatedAt: now,
    summary: {
      total: projectHealths.length,
      healthy: projectHealths.filter(p => p.status === 'healthy').length,
      warning: projectHealths.filter(p => p.status === 'warning').length,
      critical: projectHealths.filter(p => p.status === 'critical').length,
      globalVaultKeys: vaultCounts['_global'] ?? 0,
    },
    projects: projectHealths,
    topRisks: topRisks.slice(0, 10),
    recentActivity: recentLogs.slice(0, 10),
    crossProjectKeyReuse,
  };
}

function printDoctorReport(report: DoctorReport) {
  const { summary } = report;
  console.log('');
  console.log(chalk.bold('DevAssets — System Health Report'));
  console.log(chalk.gray(new Date(report.generatedAt).toLocaleString()));
  console.log('');

  const globalStr = summary.globalVaultKeys > 0
    ? chalk.cyan(`${summary.globalVaultKeys} global key${summary.globalVaultKeys !== 1 ? 's' : ''}`)
    : chalk.dim('global vault: empty');
  const summaryParts = [
    chalk.white(`${summary.total} projects`),
    chalk.green(`${summary.healthy} healthy`),
    summary.warning > 0 ? chalk.yellow(`${summary.warning} warning`) : null,
    summary.critical > 0 ? chalk.red(`${summary.critical} critical`) : null,
    globalStr,
  ].filter(Boolean);
  console.log('  ' + summaryParts.join('  ·  '));
  console.log('');

  console.log(chalk.bold('Projects'));
  for (const p of report.projects) {
    const icon = p.status === 'healthy' ? chalk.green('✅') : p.status === 'warning' ? chalk.yellow('🟡') : chalk.red('❌');
    const assets = chalk.gray(`${p.assetCount} assets`);
    const missing = p.missingCount > 0 ? chalk.red(` · ${p.missingCount} missing`) : '';
    const risks = p.riskCount > 0 ? chalk.yellow(` · ${p.riskCount} risks`) : '';
    const vault = p.vaultSecretCount > 0 ? chalk.cyan(` · ${p.vaultSecretCount} vault`) : '';
    console.log(`  ${icon} ${p.id.padEnd(20)} ${assets}${missing}${risks}${vault}`);
  }
  console.log('');

  if (report.topRisks.length > 0) {
    console.log(chalk.bold('Top Risks'));
    for (const r of report.topRisks) {
      const levelColor = r.level === 'critical' ? chalk.red : r.level === 'high' ? chalk.red : chalk.yellow;
      console.log(`  ${levelColor(`[${r.level.toUpperCase()}]`)} ${chalk.gray(r.project)} — ${r.message}`);
    }
    console.log('');
  }

  if (report.recentActivity.length > 0) {
    console.log(chalk.bold('Recent Activity (7d)'));
    for (const a of report.recentActivity) {
      const icon = a.result === 'success' ? chalk.green('✓') : chalk.red('✗');
      const time = new Date(a.timestamp).toLocaleString();
      console.log(`  ${icon} ${chalk.gray(time)}  ${a.action.padEnd(10)}  ${chalk.gray(a.project)}`);
    }
    console.log('');
  }

  if (report.crossProjectKeyReuse.length > 0) {
    console.log(chalk.bold('Cross-Project Key Reuse'));
    for (const r of report.crossProjectKeyReuse) {
      console.log(`  ${chalk.yellow('⚠')}  ${chalk.white(r.key)} ${chalk.gray(`(${r.projects.join(', ')})`)}`);
      console.log(`     ${chalk.gray(r.suggestion)}`);
    }
    console.log('');
  }
}
