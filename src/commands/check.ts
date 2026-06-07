import { getProject, getAssets, getPaymentPlatforms, addAuditLog, getCurrentUser } from '../db/queries.js';
import { validateAssets, mergePaymentRisks } from '../core/validator.js';
import { checkPaddleStatus } from '../integrations/paddle.js';
import { checkStripeStatus } from '../integrations/stripe.js';
import { formatCheckHuman, formatCheckJson } from '../core/formatter.js';
import { logger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';
import { readEnvValue } from '../utils/dotenv.js';
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

  const active = options.format !== 'json';
  const sp = createSpinner(`Checking ${project.name}…`, active).start();

  try {
    const assets = getAssets(projectId, options.env);
    const platforms = getPaymentPlatforms(projectId);

    let result = validateAssets(assets, projectId, options.env);

    const paymentStatuses: PaymentStatus[] = [];
    for (const platform of platforms) {
      sp.text = `Checking ${platform.name} status…`;
      if (platform.name === 'paddle') {
        const key = readEnvValue(project.path, 'PADDLE_API_KEY') || process.env.PADDLE_API_KEY;
        paymentStatuses.push(await checkPaddleStatus(projectId, key));
      } else if (platform.name === 'stripe') {
        const key = readEnvValue(project.path, 'STRIPE_SECRET_KEY') || process.env.STRIPE_SECRET_KEY;
        paymentStatuses.push(await checkStripeStatus(projectId, key));
      }
    }

    if (paymentStatuses.length > 0) {
      result = mergePaymentRisks(result, paymentStatuses);
    }

    sp.stop();

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
    sp.fail(`Check failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
