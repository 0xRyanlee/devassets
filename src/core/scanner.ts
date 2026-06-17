import fs from 'fs';
import path from 'path';
import { scanEnvKeys, scanDeclaredKeys, getEnvFiles } from '../utils/dotenv.js';
import { resolveScanRoots, readKeyLocations } from './roots.js';
import { PAYMENT_PLATFORM_KEY_PATTERNS } from '../utils/constants.js';
import type { Asset, PaymentPlatformName } from '../types/index.js';

// ---------- Source hardcoded-secret detection ----------

export interface HardcodedFinding {
  file: string;
  line: number;
  match: string;     // masked: first 6 chars + ****
  pattern: string;   // e.g. 'stripe', 'aws-key', 'assignment'
}

// Provider-specific patterns — very low false-positive rate
const PROVIDER_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'stripe',     re: /\b(sk_(?:live|test)_[0-9a-zA-Z]{24,})\b/ },
  { name: 'aws-key',    re: /\b(AKIA[0-9A-Z]{16})\b/ },
  { name: 'github',     re: /\b((?:ghp|gho|ghs|ghu)_[0-9a-zA-Z]{36,}|github_pat_[0-9a-zA-Z_]{36,})\b/ },
  { name: 'slack',      re: /\b(xox[bpas]-[0-9A-Za-z-]{24,})\b/ },
  { name: 'anthropic',  re: /\b(sk-ant-[0-9a-zA-Z_-]{20,})\b/ },
  { name: 'google-api', re: /\b(AIza[0-9A-Za-z_-]{35})\b/ },
  { name: 'paddle',     re: /\b(live_[0-9a-zA-Z]{40,})\b/ },
];

// Variable assignment pattern — only fires when the variable name implies a secret
const ASSIGNMENT_RE = /\b(secret|api_key|apikey|api_secret|access_token|client_secret|private_key|auth_token|service_key)\b[^=:\n]{0,40}[:=]\s*["']([A-Za-z0-9+/._\-!@#$%^&*]{20,})["']/i;

// Values that are almost certainly placeholders / examples — skip
const PLACEHOLDER_VALUE_RE = /^(?:your[_-]|<[^>]+>|example|placeholder|test|fake|xxx|changeme|replace|insert)/i;

// Source file extensions to walk
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rb', '.go']);
// Directories that never contain project source
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', 'target', '__pycache__', '.cache', '.venv', 'vendor']);

function maskValue(val: string): string {
  return val.slice(0, Math.min(6, val.length)) + '****';
}

function readIgnorePatterns(projectPath: string): string[] {
  const p = path.join(projectPath, '.devassetsignore');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

function matchesIgnore(relPath: string, patterns: string[]): boolean {
  return patterns.some(pat => relPath === pat || relPath.startsWith(pat + '/') || relPath.includes('/' + pat));
}

function walkSourceFiles(dir: string, projectPath: string, ignore: string[]): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(projectPath, abs);
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name) && !matchesIgnore(rel, ignore)) out.push(...walkSourceFiles(abs, projectPath, ignore));
    } else if (e.isFile() && SOURCE_EXTENSIONS.has(path.extname(e.name)) && !matchesIgnore(rel, ignore)) {
      out.push(abs);
    }
  }
  return out;
}

export function scanSourceHardcoded(projectPath: string): HardcodedFinding[] {
  const ignore = readIgnorePatterns(projectPath);
  const findings: HardcodedFinding[] = [];

  for (const filePath of walkSourceFiles(projectPath, projectPath, ignore)) {
    let content: string;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { continue; }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const { name, re } of PROVIDER_PATTERNS) {
        const m = re.exec(line);
        if (m && !PLACEHOLDER_VALUE_RE.test(m[1])) {
          findings.push({ file: path.relative(projectPath, filePath), line: i + 1, match: maskValue(m[1]), pattern: name });
        }
      }

      const am = ASSIGNMENT_RE.exec(line);
      if (am && !PLACEHOLDER_VALUE_RE.test(am[2])) {
        const alreadyCovered = PROVIDER_PATTERNS.some(({ re }) => re.test(line));
        if (!alreadyCovered) {
          findings.push({ file: path.relative(projectPath, filePath), line: i + 1, match: maskValue(am[2]), pattern: 'assignment' });
        }
      }
    }
  }

  return findings;
}

export interface ScanResult {
  projectId: string;
  projectPath: string;
  assets: Omit<Asset, 'id'>[];
  detectedPlatforms: PaymentPlatformName[];
  envFilesFound: string[];
  roots: string[];
  scannedAt: string;
  hardcodedFindings: HardcodedFinding[];
}

export function scanProject(projectId: string, projectPath: string): ScanResult {
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  const now = new Date().toISOString();
  const roots = resolveScanRoots(projectPath);
  const locations = readKeyLocations(projectPath);
  const assets: Omit<Asset, 'id'>[] = [];
  const envFilesFound: string[] = [];
  const allNames: string[] = [];
  const configuredNames = new Set<string>();
  const addedManaged = new Set<string>();

  const isManaged = (name: string) => {
    const loc = locations[name];
    return loc !== undefined && loc !== 'local-env';
  };

  for (const root of roots) {
    const rootAbs = path.join(projectPath, root);
    const prefix = root === '.' ? '' : `${root}/`;

    const keys = scanEnvKeys(rootAbs);
    const declared = scanDeclaredKeys(rootAbs);
    const presentNames = new Set(keys.map(k => k.name));
    allNames.push(...keys.map(k => k.name), ...declared.map(d => d.name));
    envFilesFound.push(...getEnvFiles(rootAbs).map(f => `${prefix}${f}`));

    for (const k of keys) {
      configuredNames.add(k.name);
      assets.push({
        projectId,
        name: k.name,
        location: `${prefix}${k.file}:${k.line}`,
        status: 'configured',
        environment: inferEnvironment(k.file),
        lastSeen: now,
      });
    }

    // Declared in example but absent from actual env → managed (if declared elsewhere) or missing
    const seen = new Set<string>();
    for (const d of declared) {
      if (presentNames.has(d.name) || seen.has(d.name)) continue;
      seen.add(d.name);
      if (isManaged(d.name)) {
        if (addedManaged.has(d.name)) continue;
        addedManaged.add(d.name);
        assets.push({ projectId, name: d.name, location: locations[d.name], status: 'managed', environment: undefined, lastSeen: now });
      } else {
        assets.push({ projectId, name: d.name, location: `${prefix}${d.file}:${d.line}`, status: 'missing', environment: undefined, lastSeen: now });
      }
    }
  }

  // Keys declared only in .devassets.yml as managed (not in any file) → still surface for visibility
  for (const [name, loc] of Object.entries(locations)) {
    if (loc === 'local-env' || configuredNames.has(name) || addedManaged.has(name)) continue;
    addedManaged.add(name);
    allNames.push(name);
    assets.push({ projectId, name, location: loc, status: 'managed', environment: undefined, lastSeen: now });
  }

  return {
    projectId,
    projectPath,
    assets,
    detectedPlatforms: detectPaymentPlatforms(allNames),
    envFilesFound,
    roots,
    scannedAt: now,
    hardcodedFindings: scanSourceHardcoded(projectPath),
  };
}

function inferEnvironment(filename: string): 'development' | 'staging' | 'production' | undefined {
  if (filename.includes('production') || filename.includes('prod')) return 'production';
  if (filename.includes('staging')) return 'staging';
  if (filename.includes('development') || filename === '.env.local') return 'development';
  return undefined;
}

function detectPaymentPlatforms(keyNames: string[]): PaymentPlatformName[] {
  const detected = new Set<PaymentPlatformName>();

  for (const [platform, patterns] of Object.entries(PAYMENT_PLATFORM_KEY_PATTERNS)) {
    if (keyNames.some(name => patterns.some(p => p.test(name)))) {
      detected.add(platform as PaymentPlatformName);
    }
  }

  return Array.from(detected);
}

export function getProjectEnvSummary(projectPath: string): { files: string[]; keyCount: number } {
  const files = getEnvFiles(projectPath);
  const keys = scanEnvKeys(projectPath);
  return { files, keyCount: keys.length };
}
