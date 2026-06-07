import chalk from 'chalk';

const debug = process.env.DEBUG?.includes('devassets');

export const logger = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.error(chalk.red('✗'), msg),
  debug: (msg: string) => { if (debug) console.log(chalk.gray('[debug]'), msg); },
  raw: (msg: string) => console.log(msg),
};

export function statusIcon(status: string): string {
  switch (status) {
    case 'configured':
    case 'healthy':
    case 'connected': return chalk.green('✅');
    case 'missing':
    case 'critical':
    case 'disconnected': return chalk.red('❌');
    case 'warning':
    case 'error': return chalk.yellow('🟡');
    default: return chalk.gray('○');
  }
}

export function riskIcon(level: string): string {
  switch (level) {
    case 'critical': return chalk.red('[CRITICAL]');
    case 'high': return chalk.red('[HIGH]');
    case 'medium': return chalk.yellow('[MEDIUM]');
    case 'low': return chalk.blue('[LOW]');
    default: return chalk.gray('[INFO]');
  }
}
