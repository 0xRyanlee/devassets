import path from 'path';
import { generatePortfolioReport, writePortfolioRun } from '../core/portfolio.js';
import { logger } from '../utils/logger.js';

interface PortfolioCommandOptions {
  root?: string;
  overview?: string;
  github?: boolean;
  json?: boolean;
}

export function portfolioCommand(options: PortfolioCommandOptions) {
  const root = path.resolve(options.root ?? process.cwd());
  const overviewRoot = path.resolve(options.overview ?? path.join(root, 'overview'));

  if (!options.json) logger.info(`Inspecting projects at ${root}`);
  const report = generatePortfolioReport({
    root,
    github: options.github,
    githubSnapshot: path.join(overviewRoot, 'data', 'sources', 'github', 'current.json'),
  });
  const artifacts = writePortfolioRun(report, overviewRoot);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  logger.success(`Portfolio report generated: ${artifacts.current}`);
  logger.raw(`  Run ID: ${report.runId}`);
  logger.raw(`  History: ${artifacts.history}`);
  logger.raw(`  Log: ${artifacts.log}`);
  logger.raw(`  Projects: ${report.summary.total}`);
  logger.raw(`  Attention: ${report.summary.attention}`);
  logger.raw(`  Dirty repos: ${report.summary.dirtyRepos}`);
  logger.raw(`  Unpushed repos: ${report.summary.unpushedRepos}`);
  logger.raw(`  DevAssets scans: ${report.verification.scanSucceeded} passed, ${report.verification.scanFailed} failed`);
  logger.raw('');
  logger.raw(`Next: open ${artifacts.current} for the full report`);
}
