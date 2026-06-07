import chalk from 'chalk';
import { getProject, getAuditLogs } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import type { AuditLog } from '../types/index.js';

interface AuditOptions {
  since?: string;
  format?: string;
  action?: string;
}

export function auditCommand(projectId: string, options: AuditOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const sinceDays = options.since ? parseSinceDays(options.since) : undefined;
  let logs = getAuditLogs(projectId, sinceDays);

  if (options.action) {
    logs = logs.filter(l => l.action === options.action);
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(logs, null, 2));
    return;
  }

  if (logs.length === 0) {
    logger.raw('No audit logs found for the given filters.');
    return;
  }

  console.log('');
  console.log(chalk.bold(`Audit Log: ${project.name}`));
  if (sinceDays) console.log(`  Showing last ${sinceDays} days`);
  console.log('');

  for (const log of logs) {
    const icon = log.result === 'success' ? chalk.green('✓') : chalk.red('✗');
    const time = new Date(log.timestamp).toLocaleString();
    const action = chalk.bold(log.action.padEnd(10));
    const user = chalk.gray(log.user);
    console.log(`  ${icon} ${time}  ${action}  ${user}`);

    if (log.details && Object.keys(log.details).length > 0) {
      const detail = Object.entries(log.details)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      console.log(`    ${chalk.gray(detail)}`);
    }
  }

  console.log('');
  console.log(chalk.gray(`  Total: ${logs.length} entries`));
  console.log('');
}

function parseSinceDays(since: string): number {
  const match = since.match(/^(\d+)([dDwWhH])$/);
  if (!match) return 7;
  const n = parseInt(match[1]);
  switch (match[2].toLowerCase()) {
    case 'h': return n / 24;
    case 'w': return n * 7;
    default: return n;
  }
}
