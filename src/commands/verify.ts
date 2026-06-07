import fs from 'fs';
import yaml from 'js-yaml';
import { verifySignature, decryptAES } from '../utils/crypto.js';
import { getProject, getAssets, addAuditLog, getCurrentUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import type { VerifyResult } from '../types/index.js';

interface VerifyOptions {
  manifest?: string;
  decrypt?: boolean;
  password?: string;
}

export function verifyCommand(projectId: string, options: VerifyOptions) {
  const project = getProject(projectId);
  if (!project) {
    logger.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  if (!options.manifest) {
    logger.error('--manifest=<path> is required');
    process.exit(1);
  }

  if (!fs.existsSync(options.manifest)) {
    logger.error(`Manifest file not found: ${options.manifest}`);
    process.exit(1);
  }

  try {
    let content = fs.readFileSync(options.manifest, 'utf-8');

    if (options.decrypt && options.password) {
      content = decryptAES(content, options.password);
    }

    const data = yaml.load(content) as Record<string, unknown>;
    const sig = data['signature'] as Record<string, string> | undefined;

    const errors: string[] = [];
    let signatureMatch = false;

    if (sig?.value && sig?.timestamp) {
      const dataWithoutSig = { ...data };
      delete dataWithoutSig['signature'];
      const contentWithoutSig = yaml.dump(dataWithoutSig, { lineWidth: 120, noRefs: true });

      try {
        signatureMatch = verifySignature(contentWithoutSig, sig.timestamp, sig.value);
      } catch {
        errors.push('Signature verification error — manifest may be corrupted');
      }

      if (!signatureMatch) errors.push('Signature mismatch — manifest may have been tampered with');
    } else {
      errors.push('No signature found in manifest');
    }

    const manifestAssets = (data['assets'] as Record<string, unknown>)?.['environment_variables'] as Array<{ name: string }> ?? [];
    const currentAssets = getAssets(projectId);
    const manifestNames = new Set(manifestAssets.map(a => a.name));
    const currentNames = new Set(currentAssets.map(a => a.name));

    const added = [...currentNames].filter(n => !manifestNames.has(n));
    const removed = [...manifestNames].filter(n => !currentNames.has(n));

    const result: VerifyResult = {
      valid: errors.length === 0,
      project: projectId,
      timestamp: new Date().toISOString(),
      signatureMatch,
      currentVsManifest: { added, removed, changed: [] },
      errors,
    };

    addAuditLog({
      projectId,
      action: 'verify',
      user: getCurrentUser(),
      timestamp: result.timestamp,
      details: { manifest: options.manifest, valid: result.valid, signatureMatch },
      result: result.valid ? 'success' : 'failure',
    });

    if (result.valid) {
      logger.success(`Manifest verified: ${options.manifest}`);
    } else {
      logger.error(`Verification failed:`);
      for (const e of errors) logger.raw(`  - ${e}`);
    }

    if (added.length > 0) logger.warn(`New assets not in manifest: ${added.join(', ')}`);
    if (removed.length > 0) logger.warn(`Assets in manifest but not current: ${removed.join(', ')}`);

    if (!result.valid) process.exit(1);
  } catch (err) {
    logger.error(`Verify failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
