import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SKILLS_DIR = path.resolve(fileURLToPath(import.meta.url), '../../../skills');

export function readSkillContent(name: string): string {
  const skillPath = path.join(SKILLS_DIR, `${name}.md`);
  if (!fs.existsSync(skillPath)) return `Skill "${name}" not found at ${skillPath}`;
  return fs.readFileSync(skillPath, 'utf-8');
}

export function listSkills(): string[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''));
}
