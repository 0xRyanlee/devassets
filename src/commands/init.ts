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
    logger.raw('⚠  SECURITY: ~/.devassets/ contains signature.key — the root of all vault encryption.');
    logger.raw('   If this file leaks (iCloud Drive, Time Machine, dotfiles repo, screenshot),');
    logger.raw('   every secret you have ever stored can be decrypted.');
    logger.raw('');
    logger.raw('   Required actions:');
    logger.raw('     • Add ~/.devassets/ to iCloud Drive exclusions (System Settings → iCloud → iCloud Drive → Options)');
    logger.raw('     • Add to Time Machine exclusions if applicable');
    logger.raw('     • Add to your dotfiles .gitignore: echo "~/.devassets/" >> ~/.gitignore_global');
    logger.raw('   Loss of signature.key means all stored secrets are permanently unrecoverable —');
    logger.raw('   back it up now: devassets key-export --encrypt-for <password>');
    logger.raw('');
    logger.raw('Next steps:');
    logger.raw('  1. devassets add-project <name> --path=<path>');
    logger.raw('  2. devassets scan <project>');
    logger.raw('  3. devassets check <project>');
    logger.raw('  4. devassets identity <project>   # resolve provider accounts');
    logger.raw('');
    logger.raw('Global credentials (shared across all projects):');
    logger.raw('  devassets set _global VERCEL_TOKEN     --provider=vercel');
    logger.raw('  devassets set _global ANTHROPIC_API_KEY --provider=anthropic');
    logger.raw('  devassets set _global GITHUB_TOKEN     --provider=github');
    logger.raw('  (stored once in the global vault, accessible from any project)');
  } catch (err) {
    logger.error(`Initialization failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
