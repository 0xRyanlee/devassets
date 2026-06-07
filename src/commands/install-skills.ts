import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const SKILLS_DIR = path.resolve(fileURLToPath(import.meta.url), '../../../skills');
const TARGET_DIR = path.join(process.env.HOME ?? '~', '.claude', 'commands');

interface InstallOptions {
  force?: boolean;
  list?: boolean;
}

export function installSkillsCommand(options: InstallOptions) {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(chalk.red('Skills directory not found. Reinstall @hyphen-network/devassets.'));
    process.exit(1);
  }

  const skills = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));

  if (options.list) {
    console.log(chalk.bold('Available skills:'));
    for (const s of skills) {
      const name = s.replace(/\.md$/, '');
      const installed = fs.existsSync(path.join(TARGET_DIR, s));
      const status = installed ? chalk.green('installed') : chalk.gray('not installed');
      console.log(`  /${name}  ${status}`);
    }
    return;
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });

  let installed = 0;
  let skipped = 0;

  for (const skill of skills) {
    const src = path.join(SKILLS_DIR, skill);
    const dest = path.join(TARGET_DIR, skill);
    if (fs.existsSync(dest) && !options.force) {
      console.log(chalk.gray(`  skip  ${skill}  (already installed, use --force to overwrite)`));
      skipped++;
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(chalk.green(`  ✓  /${skill.replace(/\.md$/, '')}  →  ${dest}`));
    installed++;
  }

  console.log('');
  if (installed > 0) {
    console.log(chalk.bold(`Installed ${installed} skill(s) to ${TARGET_DIR}`));
    console.log(chalk.gray('Restart Claude Code to pick up new slash commands.'));
  }
  if (skipped > 0) {
    console.log(chalk.gray(`Skipped ${skipped} already-installed skill(s).`));
  }
}
