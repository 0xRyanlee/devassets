import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ENV_FILE_PATTERNS, EXAMPLE_FILE_PATTERNS } from '../utils/constants.js';
import { readEnvValue } from '../utils/dotenv.js';
import { logger } from '../utils/logger.js';

// Transiently read a secret value across all scan roots (monorepo-aware). Never persisted.
export function readProjectEnvValue(projectPath: string, keyName: string): string | undefined {
  for (const root of resolveScanRoots(projectPath)) {
    const v = readEnvValue(path.join(projectPath, root), keyName);
    if (v) return v;
  }
  return undefined;
}

const MANIFESTS = ['package.json', 'Cargo.toml', 'tauri.conf.json', 'pyproject.toml', 'requirements.txt'];
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'target', 'archive', 'vendor', '.turbo', 'coverage', '.cache', 'tmp']);

function hasEnvFile(dir: string): boolean {
  return [...ENV_FILE_PATTERNS, ...EXAMPLE_FILE_PATTERNS].some(p => fs.existsSync(path.join(dir, p)));
}

function hasManifest(dir: string): boolean {
  return MANIFESTS.some(m => fs.existsSync(path.join(dir, m)));
}

// Resolve which sub-directories of a project to scan for env files.
// Three layers, in priority order: .devassets.yml roots > workspace manifest > smart discovery.
export function resolveScanRoots(projectPath: string): string[] {
  const explicit = readDevassetsRoots(projectPath);
  if (explicit.length > 0) return dedupeWithRoot(projectPath, explicit);

  const workspace = readWorkspaceRoots(projectPath);
  if (workspace.length > 0) return dedupeWithRoot(projectPath, workspace);

  return dedupeWithRoot(projectPath, discoverRoots(projectPath));
}

function dedupeWithRoot(projectPath: string, roots: string[]): string[] {
  const set = new Set<string>();
  if (hasEnvFile(projectPath)) set.add('.');
  for (const r of roots) {
    const abs = path.join(projectPath, r);
    if (hasEnvFile(abs)) set.add(r === '' ? '.' : r);
  }
  if (set.size === 0) set.add('.');
  return [...set];
}

// Per-key secret location declarations from .devassets.yml `secrets:` (Axis B)
export function readKeyLocations(projectPath: string): Record<string, string> {
  const file = path.join(projectPath, '.devassets.yml');
  if (!fs.existsSync(file)) return {};
  try {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as { secrets?: Record<string, string> } | null;
    return doc?.secrets ?? {};
  } catch (err) {
    logger.warn(`.devassets.yml parse error in ${projectPath} — secrets: config ignored (${err instanceof Error ? err.message : err})`);
    return {};
  }
}

// Layer 1 — explicit declaration
function readDevassetsRoots(projectPath: string): string[] {
  const file = path.join(projectPath, '.devassets.yml');
  if (!fs.existsSync(file)) return [];
  try {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as { roots?: string[] } | null;
    return (doc?.roots ?? []).filter(r => typeof r === 'string').map(normalizeRel);
  } catch (err) {
    logger.warn(`.devassets.yml parse error in ${projectPath} — roots: config ignored, falling back to discovery (${err instanceof Error ? err.message : err})`);
    return [];
  }
}

// Layer 2 — workspace manifest
function readWorkspaceRoots(projectPath: string): string[] {
  const globs: string[] = [];

  const pnpm = path.join(projectPath, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpm)) {
    try {
      const doc = yaml.load(fs.readFileSync(pnpm, 'utf-8')) as { packages?: string[] } | null;
      globs.push(...(doc?.packages ?? []));
    } catch { /* ignore */ }
  }

  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const ws = pkg.workspaces;
      if (Array.isArray(ws)) globs.push(...ws);
      else if (ws?.packages) globs.push(...ws.packages);
    } catch { /* ignore */ }
  }

  const cargo = path.join(projectPath, 'Cargo.toml');
  if (fs.existsSync(cargo)) {
    const content = fs.readFileSync(cargo, 'utf-8');
    const m = content.match(/members\s*=\s*\[([^\]]*)\]/);
    if (m) globs.push(...[...m[1].matchAll(/["']([^"']+)["']/g)].map(g => g[1]));
  }

  return globs.flatMap(g => expandGlob(projectPath, normalizeRel(g)));
}

// Layer 3 — smart discovery: dirs with a manifest AND an env file (skips archives/fixtures)
function discoverRoots(projectPath: string, rel = '', depth = 0): string[] {
  if (depth > 3) return [];
  const found: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(projectPath, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const childAbs = path.join(projectPath, childRel);
    if (hasManifest(childAbs) && hasEnvFile(childAbs)) found.push(childRel);
    found.push(...discoverRoots(projectPath, childRel, depth + 1));
  }
  return found;
}

function expandGlob(projectPath: string, pattern: string): string[] {
  if (!pattern.includes('*')) {
    return fs.existsSync(path.join(projectPath, pattern)) ? [pattern] : [];
  }
  const segments = pattern.split('/');
  let current = [''];
  for (const seg of segments) {
    const next: string[] = [];
    for (const base of current) {
      const baseAbs = path.join(projectPath, base);
      if (seg === '*' || seg === '**') {
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(baseAbs, { withFileTypes: true }); } catch { /* ignore */ }
        for (const e of entries) {
          if (e.isDirectory() && !IGNORE_DIRS.has(e.name) && !e.name.startsWith('.')) {
            next.push(base ? `${base}/${e.name}` : e.name);
          }
        }
      } else {
        next.push(base ? `${base}/${seg}` : seg);
      }
    }
    current = next;
  }
  return current.filter(d => fs.existsSync(path.join(projectPath, d)));
}

function normalizeRel(p: string): string {
  return p.replace(/^\.\//, '').replace(/\/$/, '');
}
