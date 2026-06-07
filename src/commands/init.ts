import { getDb } from '../db/index.js';
import { initPermissionsFile } from '../core/permissions.js';
import { getSignatureKey } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { DB_PATH, DEVASSETS_DIR } from '../utils/constants.js';

export function initCommand() {
  try {
    getDb();
    getSignatureKey();
    initPermissionsFile();

    logger.success('DevAssets initialized');
    logger.raw(`  Database:    ${DB_PATH}`);
    logger.raw(`  Config dir:  ${DEVASSETS_DIR}`);
    logger.raw('');
    logger.raw('Next steps:');
    logger.raw('  devassets add-project <name> --path=<path>');
    logger.raw('  devassets scan <project>');
  } catch (err) {
    logger.error(`Initialization failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
