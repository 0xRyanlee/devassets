import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SKILLS_DIR = path.resolve(fileURLToPath(import.meta.url), '../../../skills');

export function readSkillContent(name: string): string {
  const skillPath = path.join(SKILLS_DIR, `${name}.md`);
  const resolved = path.resolve(skillPath);
  if (!resolved.startsWith(SKILLS_DIR + path.sep)) throw new Error(`Invalid skill name: ${name}`);
  if (!fs.existsSync(resolved)) return `Skill "${name}" not found`;
  return fs.readFileSync(resolved, 'utf-8');
}

export function listSkills(): string[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''));
}
