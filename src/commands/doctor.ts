import chalk from 'chalk';
import { listProjects, getAssets, getPaymentPlatforms, getAuditLogs } from '../db/queries.js';
import { validateAssets } from '../core/validator.js';
import { logger } from '../utils/logger.js';

interface DoctorOptions {
  json?: boolean;
}

export interface DoctorReport {
  generatedAt: string;
  summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
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

export function doctorCommand(options: DoctorOptions) {
  const projects = listProjects();

  if (projects.length === 0) {
    logger.warn('No projects registered. Run: devassets add-project <name> --path=<path>');
    return;
  }

  const report = buildDoctorReport(projects);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printDoctorReport(report);
}

export function buildDoctorReport(projects: ReturnType<typeof listProjects>): DoctorReport {
  const now = new Date().toISOString();
  const projectHealths: ProjectHealth[] = [];
  const topRisks: TopRisk[] = [];

  for (const project of projects) {
    const assets = getAssets(project.id);
    const result = validateAssets(assets, project.id);
    const lastLog = getAuditLogs(project.id, 30)[0];

    projectHealths.push({
      id: project.id,
      name: project.name,
      status: result.status,
      assetCount: result.assets.total,
      missingCount: result.assets.missing,
      riskCount: result.risks.length,
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

  const summaryParts = [
    chalk.white(`${summary.total} projects`),
    chalk.green(`${summary.healthy} healthy`),
    summary.warning > 0 ? chalk.yellow(`${summary.warning} warning`) : null,
    summary.critical > 0 ? chalk.red(`${summary.critical} critical`) : null,
  ].filter(Boolean);
  console.log('  ' + summaryParts.join('  ·  '));
  console.log('');

  console.log(chalk.bold('Projects'));
  for (const p of report.projects) {
    const icon = p.status === 'healthy' ? chalk.green('✅') : p.status === 'warning' ? chalk.yellow('🟡') : chalk.red('❌');
    const assets = chalk.gray(`${p.assetCount} assets`);
    const missing = p.missingCount > 0 ? chalk.red(` · ${p.missingCount} missing`) : '';
    const risks = p.riskCount > 0 ? chalk.yellow(` · ${p.riskCount} risks`) : '';
    console.log(`  ${icon} ${p.id.padEnd(20)} ${assets}${missing}${risks}`);
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
