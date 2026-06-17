import { getProject, replaceAssets, upsertPaymentPlatform, addAuditLog, getCurrentUser } from '../db/queries.js';
import { scanProject } from '../core/scanner.js';
import { logger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';

interface ScanOptions {
  json?: boolean;
}

export function scanCommand(projectId: string, options: ScanOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    logger.raw('Run: devassets add-project <name> --path=<path>');
    process.exit(1);
  }

  const sp = createSpinner(`Scanning ${project.name}…`, !options.json).start();

  try {
    const result = scanProject(projectId, project.path);

    replaceAssets(projectId, result.assets);

    for (const platform of result.detectedPlatforms) {
      upsertPaymentPlatform({
        projectId,
        name: platform,
        status: 'unconfigured',
      });
    }

    addAuditLog({
      projectId,
      action: 'scan',
      user: getCurrentUser(),
      timestamp: result.scannedAt,
      details: {
        assetsFound: result.assets.length,
        envFiles: result.envFilesFound,
        platforms: result.detectedPlatforms,
      },
      result: 'success',
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    sp.succeed(`Scan complete: ${project.name}`);
    if (result.roots.length > 1 || (result.roots[0] && result.roots[0] !== '.')) {
      logger.raw(`  Roots:     ${result.roots.join(', ')}`);
    }
    logger.raw(`  Env files: ${result.envFilesFound.join(', ') || 'none'}`);
    logger.raw(`  Assets:    ${result.assets.length}`);
    logger.raw(`  Platforms: ${result.detectedPlatforms.join(', ') || 'none detected'}`);
    if (result.hardcodedFindings.length > 0) {
      logger.raw(`  Hardcoded: ${result.hardcodedFindings.length} potential secret(s) found in source files`);
      for (const f of result.hardcodedFindings) {
        logger.raw(`    [${f.pattern}] ${f.file}:${f.line}  ${f.match}`);
      }
      logger.raw(`  Add paths to .devassetsignore to suppress false positives.`);
    }
    logger.raw('');
    logger.raw(`Next: devassets check ${projectId}`);
  } catch (err) {
    addAuditLog({
      projectId,
      action: 'scan',
      user: getCurrentUser(),
      timestamp: new Date().toISOString(),
      details: { error: String(err) },
      result: 'failure',
    });
    sp.fail(`Scan failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
