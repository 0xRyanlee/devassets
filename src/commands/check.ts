import { getProject, getAssets, getPaymentPlatforms, addAuditLog, getCurrentUser } from '../db/queries.js';
import { validateAssets, mergePaymentRisks } from '../core/validator.js';
import { checkPaddleStatus } from '../integrations/paddle.js';
import { formatCheckHuman, formatCheckJson } from '../core/formatter.js';
import { logger } from '../utils/logger.js';
import type { PaymentStatus } from '../types/index.js';

interface CheckOptions {
  env?: string;
  format?: string;
  failOnRisk?: boolean;
  debug?: boolean;
}

export async function checkCommand(projectId: string, options: CheckOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  try {
    const assets = getAssets(projectId, options.env);
    const platforms = getPaymentPlatforms(projectId);

    let result = validateAssets(assets, projectId, options.env);

    const paymentStatuses: PaymentStatus[] = [];
    for (const platform of platforms) {
      if (platform.name === 'paddle') {
        const paddleApiKey = process.env.PADDLE_API_KEY;
        const status = await checkPaddleStatus(projectId, paddleApiKey);
        paymentStatuses.push(status);
      }
    }

    if (paymentStatuses.length > 0) {
      result = mergePaymentRisks(result, paymentStatuses);
    }

    addAuditLog({
      projectId,
      action: 'check',
      user: getCurrentUser(),
      timestamp: result.timestamp,
      details: { environment: options.env, status: result.status },
      result: 'success',
    });

    if (options.format === 'json') {
      console.log(formatCheckJson(result));
    } else {
      console.log(formatCheckHuman(result));
    }

    if (options.failOnRisk && result.status !== 'healthy') {
      process.exit(1);
    }
  } catch (err) {
    logger.error(`Check failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
