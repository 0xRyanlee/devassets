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
    logger.raw('⚠  Security: keep ~/.devassets/ off cloud backups.');
    logger.raw('   The vault encryption key is derived from signature.key in that directory.');
    logger.raw('   If it leaks (iCloud, Time Machine, dotfiles repo), all stored secrets are exposed.');
    logger.raw('   Add ~/.devassets/ to your .gitignore and backup exclusions.');
    logger.raw('');
    logger.raw('Next steps:');
    logger.raw('  1. devassets add-project <name> --path=<path>');
    logger.raw('  2. devassets scan <project>');
    logger.raw('  3. devassets check <project>');
    logger.raw('  4. devassets identity <project>   # resolve provider accounts');
  } catch (err) {
    logger.error(`Initialization failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
