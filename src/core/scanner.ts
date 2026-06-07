import fs from 'fs';
import path from 'path';
import { scanEnvKeys, scanDeclaredKeys, getEnvFiles } from '../utils/dotenv.js';
import { PAYMENT_PLATFORM_KEY_PATTERNS } from '../utils/constants.js';
import type { Asset, PaymentPlatformName } from '../types/index.js';

export interface ScanResult {
  projectId: string;
  projectPath: string;
  assets: Omit<Asset, 'id'>[];
  detectedPlatforms: PaymentPlatformName[];
  envFilesFound: string[];
  scannedAt: string;
}

export function scanProject(projectId: string, projectPath: string): ScanResult {
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  const envFiles = getEnvFiles(projectPath);
  const keys = scanEnvKeys(projectPath);
  const declared = scanDeclaredKeys(projectPath);
  const now = new Date().toISOString();

  const presentNames = new Set(keys.map(k => k.name));

  const assets: Omit<Asset, 'id'>[] = keys.map(k => ({
    projectId,
    name: k.name,
    location: `${k.file}:${k.line}`,
    status: 'configured' as const,
    environment: inferEnvironment(k.file),
    lastSeen: now,
  }));

  // Keys declared in example files but absent from actual env → missing
  const seenMissing = new Set<string>();
  for (const d of declared) {
    if (presentNames.has(d.name) || seenMissing.has(d.name)) continue;
    seenMissing.add(d.name);
    assets.push({
      projectId,
      name: d.name,
      location: `${d.file}:${d.line}`,
      status: 'missing',
      environment: undefined,
      lastSeen: now,
    });
  }

  const detectedPlatforms = detectPaymentPlatforms([...presentNames, ...declared.map(d => d.name)]);

  return {
    projectId,
    projectPath,
    assets,
    detectedPlatforms,
    envFilesFound: envFiles,
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
