import { getProject, getAssets, getPaymentPlatforms, addAuditLog, getCurrentUser, findSecretAcrossProjects, getVaultSecretFallback } from '../db/queries.js';
import { validateAssets, mergePaymentRisks } from '../core/validator.js';
import { checkPaddleStatus } from '../integrations/paddle.js';
import { checkStripeStatus } from '../integrations/stripe.js';
import { formatCheckHuman, formatCheckJson } from '../core/formatter.js';
import { logger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';
import { readProjectEnvValue } from '../core/roots.js';
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
    logger.raw(`  Run: devassets add-project ${projectId} --path=<path> to register it first`);
    process.exit(1);
  }

  const active = options.format !== 'json';
  const sp = createSpinner(`Checking ${project.name}…`, active).start();

  try {
    const assets = getAssets(projectId, options.env);
    if (assets.length === 0 && active) {
      sp.stop();
      logger.warn(`No assets found for ${project.name} — run "devassets scan ${projectId}" first`);
    }
    const platforms = getPaymentPlatforms(projectId);

    let result = validateAssets(assets, projectId, options.env, project.type);

    const paymentStatuses: PaymentStatus[] = [];
    // When no env is specified, default to 'production' for payment key lookups —
    // payment integrations are most meaningful against production credentials.
    const vaultEnv = options.env ?? 'production';
    for (const platform of platforms) {
      sp.text = `Checking ${platform.name} status…`;
      if (platform.name === 'paddle') {
        const key = readProjectEnvValue(project.path, 'PADDLE_API_KEY')
          || process.env.PADDLE_API_KEY
          || getVaultSecretFallback(projectId, vaultEnv, 'PADDLE_API_KEY')?.value;
        paymentStatuses.push(await checkPaddleStatus(projectId, key));
      } else if (platform.name === 'stripe') {
        const key = readProjectEnvValue(project.path, 'STRIPE_SECRET_KEY')
          || process.env.STRIPE_SECRET_KEY
          || getVaultSecretFallback(projectId, vaultEnv, 'STRIPE_SECRET_KEY')?.value;
        paymentStatuses.push(await checkStripeStatus(projectId, key));
      }
    }

    // Annotate missing assets with vault matches so agents can locate credentials
    const vaultHints: Record<string, string> = {};
    for (const asset of result.categories.environmentVariables.filter(a => a.status === 'missing')) {
      const matches = findSecretAcrossProjects(asset.name);
      if (matches.length > 0) {
        vaultHints[asset.name] = matches.map(m => `vault:${m.projectId}[${m.env}]`).join(', ');
      }
    }
    if (Object.keys(vaultHints).length > 0) {
      (result as unknown as Record<string, unknown>).vaultHints = vaultHints;
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
