import { Command } from 'commander';
import { scheduleUpdateCheck } from './utils/update-check.js';
import { initCommand } from './commands/init.js';
import { addProjectCommand } from './commands/add-project.js';
import { scanCommand } from './commands/scan.js';
import { checkCommand } from './commands/check.js';
import { exportCommand } from './commands/export.js';
import { verifyCommand } from './commands/verify.js';
import { rotateCommand } from './commands/rotate.js';
import { auditCommand } from './commands/audit.js';
import { serveCommand } from './commands/serve.js';
import { doctorCommand } from './commands/doctor.js';
import { installSkillsCommand } from './commands/install-skills.js';
import { identityCommand } from './commands/identity.js';
import { portfolioCommand } from './commands/portfolio.js';
import { statusCommand } from './commands/status.js';
import { setCommand } from './commands/set.js';
import { getCommand } from './commands/get.js';
import { listCommand } from './commands/list.js';
import { unsetCommand } from './commands/unset.js';
import { injectCommand } from './commands/inject.js';
import { runCommand } from './commands/run.js';
import { ipcCommand } from './commands/ipc.js';

const program = new Command();

program
  .name('devassets')
  .description('Developer asset management for independent developers')
  .version('1.11.20260611')
  .hook('preAction', () => { scheduleUpdateCheck('1.11.20260611'); })
  .action(() => statusCommand({}));

program
  .command('status')
  .description('Overview of all projects — vault secrets, asset health, identity, last scan')
  .option('--json', 'Output JSON')
  .action(statusCommand);

program
  .command('init')
  .description('Initialize DevAssets (creates DB, signature key, permissions file)')
  .action(initCommand);

program
  .command('add-project <name>')
  .description('Register a project with DevAssets')
  .option('--path <path>', 'Path to project directory (default: ./<name>)')
  .option('--type <type>', 'Project type: saas | mobile | desktop | library | other', 'other')
  .option('--id <id>', 'Explicit project ID (overrides auto-derived slug)')
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
  .option('--json', 'Output JSON')
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
  .command('serve')
  .description('Start DevAssets as an MCP server (stdio)')
  .action(serveCommand);

program
  .command('doctor')
  .description('Global health report across all registered projects')
  .option('--json', 'Output JSON')
  .option('--fix', 'Re-scan all projects to refresh stale asset records')
  .action(doctorCommand);

program
  .command('identity <project>')
  .description('Resolve which account/workspace each provider token belongs to (Vercel, Supabase, Neon, npm, GCloud)')
  .option('--json', 'Output JSON')
  .option('--pin', 'Pin the resolved account/workspace as expected; future drift will warn')
  .action(identityCommand);

program
  .command('install-skills')
  .description('Install devassets Claude Code slash commands to ~/.claude/commands/')
  .option('--force', 'Overwrite already-installed skills')
  .option('--list', 'List available skills and their install status')
  .action(installSkillsCommand);

program
  .command('portfolio')
  .description('Generate a portfolio report for all projects under a root directory')
  .option('--root <path>', 'Projects root directory (default: current directory)')
  .option('--overview <path>', 'Output root for snapshots and logs (default: <root>/overview)')
  .option('--no-github', 'Skip GitHub repository and workflow queries')
  .option('--json', 'Output full report as JSON')
  .action(portfolioCommand);

// ── Vault commands ────────────────────────────────────────────────────────────

program
  .command('set <project> <key> [value]')
  .description('Store an encrypted secret value for a project (use _global as project for account-level credentials)')
  .option('--env <env>', 'Environment (default: local)')
  .option('--provider <provider>', 'Provider hint (e.g. vercel, supabase)')
  .option('--account <account>', 'Account/email hint')
  .action(setCommand);

program
  .command('get <project> <key>')
  .description('Retrieve a secret value (use _global as project for account-level credentials)')
  .option('--env <env>', 'Environment (default: local)')
  .option('--raw', 'No trailing newline (safe for subshell capture)')
  .action(getCommand);

program
  .command('list <project>')
  .description('List stored secret keys and metadata — use _global to show account-level credentials')
  .option('--env <env>', 'Filter by environment')
  .option('--json', 'Output JSON')
  .action(listCommand);

program
  .command('unset <project> <key>')
  .description('Delete a stored secret')
  .option('--env <env>', 'Environment (default: local)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(unsetCommand);

program
  .command('inject <project>')
  .description('Load secrets into the current process environment (for scripting)')
  .option('--env <env>', 'Environment (default: local)')
  .option('--keys <keys>', 'Comma-separated list of keys to inject (default: all)', (v) => v.split(','))
  .option('--print', 'Print export statements instead of mutating process.env')
  .action(injectCommand);

program
  .command('run <project>')
  .description('Run a command with secrets injected as environment variables')
  .option('--env <env>', 'Environment (default: local)')
  .option('--keys <keys>', 'Comma-separated list of keys to inject (default: all)', (v) => v.split(','))
  .allowUnknownOption()
  .action((projectId: string, options: { env?: string; keys?: string[] }, cmd) => {
    // cmd.args are the unparsed tokens after the positional argument.
    // commander strips '--' separator; drop it if present for robustness.
    const raw: string[] = cmd.args as string[];
    const args = raw[0] === '--' ? raw.slice(1) : raw;
    runCommand(projectId, args, options);
  });

program
  .command('ipc')
  .description('JSON-lines IPC server for Sparkie integration (reads from stdin, writes to stdout)')
  .action(ipcCommand);

export { program };
