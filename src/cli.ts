import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { addProjectCommand } from './commands/add-project.js';
import { scanCommand } from './commands/scan.js';
import { checkCommand } from './commands/check.js';
import { exportCommand } from './commands/export.js';
import { verifyCommand } from './commands/verify.js';
import { rotateCommand } from './commands/rotate.js';
import { auditCommand } from './commands/audit.js';
import { uiCommand } from './commands/ui.js';
import { serveCommand } from './commands/serve.js';
import { doctorCommand } from './commands/doctor.js';
import { installSkillsCommand } from './commands/install-skills.js';

const program = new Command();

program
  .name('devassets')
  .description('Developer asset management for independent developers')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize DevAssets (creates DB, signature key, permissions file)')
  .action(initCommand);

program
  .command('add-project <name>')
  .description('Register a project with DevAssets')
  .option('--path <path>', 'Path to project directory (default: ./<name>)')
  .option('--type <type>', 'Project type: saas | mobile | desktop | library | other', 'other')
  .action(addProjectCommand);

program
  .command('scan <project>')
  .description('Scan a project\'s .env files and update asset records')
  .option('--json', 'Output JSON')
  .action(scanCommand);

program
  .command('check <project>')
  .description('Check project asset health and risks')
  .option('--env <environment>', 'Filter by environment')
  .option('--format <format>', 'Output format: human | json', 'human')
  .option('--fail-on-risk', 'Exit code 1 if status is warning or critical (for CI)')
  .option('--debug', 'Enable debug output')
  .action(checkCommand);

program
  .command('export <project>')
  .description('Export a signed asset manifest')
  .option('--env <environment>', 'Environment', 'production')
  .option('--format <format>', 'manifest | checklist | reference-only', 'manifest')
  .option('--output <path>', 'Output file path')
  .option('--stdout', 'Print to stdout instead of saving file')
  .option('--encrypt', 'Encrypt the manifest')
  .option('--encrypt-for <password>', 'Password for AES encryption')
  .action(exportCommand);

program
  .command('verify <project>')
  .description('Verify a manifest\'s signature and compare with current state')
  .option('--manifest <path>', 'Path to manifest file')
  .option('--decrypt', 'Decrypt before verifying')
  .option('--password <password>', 'Decryption password')
  .action(verifyCommand);

program
  .command('rotate <project> <key>')
  .description('Initiate API key rotation (records intent, provides instructions)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(rotateCommand);

program
  .command('audit <project>')
  .description('View audit log for a project')
  .option('--since <period>', 'Time period: 7d, 30d, 1w, 24h', '7d')
  .option('--action <action>', 'Filter by action type')
  .option('--format <format>', 'Output format: human | json', 'human')
  .action(auditCommand);

program
  .command('ui')
  .description('Start the DevAssets web dashboard')
  .option('--port <port>', 'Port to listen on', String(9090))
  .option('--no-open', 'Do not auto-open browser')
  .action(uiCommand);

program
  .command('serve')
  .description('Start DevAssets as an MCP server (stdio)')
  .action(serveCommand);

program
  .command('doctor')
  .description('Global health report across all registered projects')
  .option('--json', 'Output JSON')
  .action(doctorCommand);

program
  .command('install-skills')
  .description('Install devassets Claude Code slash commands to ~/.claude/commands/')
  .option('--force', 'Overwrite already-installed skills')
  .option('--list', 'List available skills and their install status')
  .action(installSkillsCommand);

export { program };
