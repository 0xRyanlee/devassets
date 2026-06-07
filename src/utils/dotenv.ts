import fs from 'fs';
import path from 'path';
import { ENV_FILE_PATTERNS, EXAMPLE_FILE_PATTERNS } from './constants.js';

export interface EnvKey {
  name: string;
  file: string;
  line: number;
}

function scanKeys(projectPath: string, patterns: string[]): EnvKey[] {
  const keys: EnvKey[] = [];
  const resolvedRoot = path.resolve(projectPath);

  for (const pattern of patterns) {
    const filePath = path.join(projectPath, pattern);
    const resolvedFile = path.resolve(filePath);
    if (!resolvedFile.startsWith(resolvedRoot + path.sep) && resolvedFile !== resolvedRoot) {
      // Pattern escapes project root — misconfiguration or attack; surface it rather than silently skip
      throw new Error(`dotenv pattern "${pattern}" resolves outside project root: ${resolvedFile}`);
    }
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) return;
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) keys.push({ name: match[1], file: pattern, line: idx + 1 });
    });
  }

  return keys;
}

export function scanEnvKeys(projectPath: string): EnvKey[] {
  return scanKeys(projectPath, ENV_FILE_PATTERNS);
}

// Keys declared in .env.example / .env.sample / .env.template — the "required" set
export function scanDeclaredKeys(projectPath: string): EnvKey[] {
  return scanKeys(projectPath, EXAMPLE_FILE_PATTERNS);
}

export function getEnvFiles(projectPath: string): string[] {
  return ENV_FILE_PATTERNS.filter(p => fs.existsSync(path.join(projectPath, p)));
}
