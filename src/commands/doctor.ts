import chalk from 'chalk';
import fs from 'fs';
import { Listr } from 'listr2';
import { listProjects, getAssets, getPaymentPlatforms, getAuditLogs, replaceAssets, upsertPaymentPlatform, addAuditLog, getCurrentUser, getVaultSecretCounts } from '../db/queries.js';
import { validateAssets } from '../core/validator.js';
import { scanProject } from '../core/scanner.js';
import { logger } from '../utils/logger.js';

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
          upsertPaymentPlatform({ projectId: p.id, name: platform, status: 'unconfigured' });
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

  for (const project of projects) {
    const assets = getAssets(project.id);
    const result = validateAssets(assets, project.id, undefined, project.type);
    const lastLog = getAuditLogs(project.id, 30)[0];

    projectHealths.push({
      id: project.id,
      name: project.name,
      status: result.status,
      assetCount: result.assets.total,
      missingCount: result.assets.missing,
      riskCount: result.risks.length,
      vaultSecretCount: vaultCounts[project.id] ?? 0,
      lastScanned: lastLog?.timestamp,
    });

    for (const risk of result.risks.slice(0, 2)) {
      topRisks.push({ project: project.id, level: risk.level, asset: risk.asset, message: risk.message });
    }
  }

  topRisks.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.level as keyof typeof order] ?? 4) - (order[b.level as keyof typeof order] ?? 4);
  });

  const recentLogs = projects
    .flatMap(p => getAuditLogs(p.id, 7).slice(0, 3).map(l => ({
      project: p.id,
      action: l.action,
      timestamp: l.timestamp,
      result: l.result,
    })))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

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
    recentActivity: recentLogs,
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
}
