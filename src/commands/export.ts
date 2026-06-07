import { getProject, getAssets, getPaymentPlatforms, addAuditLog, getCurrentUser } from '../db/queries.js';
import { validateAssets, mergePaymentRisks } from '../core/validator.js';
import { exportManifest, generateOutputPath } from '../core/exporter.js';
import { formatExportHuman } from '../core/formatter.js';
import { logger } from '../utils/logger.js';
import type { ManifestFormat } from '../types/index.js';

interface ExportOptions {
  env?: string;
  format?: string;
  output?: string;
  encrypt?: boolean;
  encryptFor?: string;
  stdout?: boolean;
}

export function exportCommand(projectId: string, options: ExportOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const environment = options.env ?? 'production';
  const format = (options.format ?? 'manifest') as ManifestFormat;

  try {
    const assets = getAssets(projectId, environment);
    const platforms = getPaymentPlatforms(projectId);
    let checkResult = validateAssets(assets, projectId, environment);
    if (platforms.length > 0) checkResult = mergePaymentRisks(checkResult, []);

    const outputPath = options.stdout ? undefined :
      (options.output ?? generateOutputPath(projectId, environment, format));

    const result = exportManifest(checkResult, {
      project: projectId,
      environment,
      format,
      encrypt: options.encrypt,
      encryptFor: options.encryptFor,
      outputPath,
    });

    addAuditLog({
      projectId,
      action: 'export',
      user: getCurrentUser(),
      timestamp: result.timestamp,
      details: { environment, format, encrypted: result.encrypted, outputPath: result.outputPath },
      result: 'success',
    });

    if (options.stdout) {
      console.log(result.content);
      return;
    }

    console.log(formatExportHuman(result));
  } catch (err) {
    logger.error(`Export failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
