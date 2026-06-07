import fs from 'fs';
import path from 'path';
import { scanEnvKeys, scanDeclaredKeys, getEnvFiles } from '../utils/dotenv.js';
import { resolveScanRoots, readKeyLocations } from './roots.js';
import { PAYMENT_PLATFORM_KEY_PATTERNS } from '../utils/constants.js';
import type { Asset, PaymentPlatformName } from '../types/index.js';

export interface ScanResult {
  projectId: string;
  projectPath: string;
  assets: Omit<Asset, 'id'>[];
  detectedPlatforms: PaymentPlatformName[];
  envFilesFound: string[];
  roots: string[];
  scannedAt: string;
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
