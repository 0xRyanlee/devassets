import fs from 'fs';
import path from 'path';
import { DEVASSETS_DIR } from './constants.js';
import { isInteractive } from './env.js';

const CACHE_FILE = path.join(DEVASSETS_DIR, 'last-update-check.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PACKAGE_NAME = '@hyphen-network/devassets';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

interface CacheEntry {
  checkedAt: number;
  latestVersion: string;
}

function readCache(): CacheEntry | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  try {
    fs.mkdirSync(DEVASSETS_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry));
  } catch {
    // non-fatal: cache write failures are silently ignored
  }
}

function isNewer(current: string, latest: string): boolean {
  // Date-suffixed versions: 0.10.20260611 — numeric comparison works for YYYYMMDD suffix
  const parse = (v: string) => v.split('.').map(Number);
  const [cMaj, cMin, cPatch] = parse(current);
  const [lMaj, lMin, lPatch] = parse(latest);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > (cPatch ?? 0);
}

// Fire-and-forget: check npm registry in background, print warning after command output
export function scheduleUpdateCheck(currentVersion: string): void {
  if (!isInteractive()) return;

  const cache = readCache();
  if (cache && Date.now() - cache.checkedAt < CACHE_TTL_MS) {
    if (isNewer(currentVersion, cache.latestVersion)) {
      printUpdateWarning(currentVersion, cache.latestVersion);
    }
    return;
  }

  // Defer the network call until after the command finishes
  process.on('exit', () => {
    // 'exit' handlers are synchronous — we can't do async fetch here.
    // The check already ran via the async path below; this is a no-op guard.
  });

  // Run async check without blocking the current command
  setImmediate(() => {
    fetchLatestVersion()
      .then((latest) => {
        writeCache({ checkedAt: Date.now(), latestVersion: latest });
        if (isNewer(currentVersion, latest)) {
          printUpdateWarning(currentVersion, latest);
        }
      })
      .catch(() => {
        // Network unavailable — silently skip; don't pollute output
      });
  });
}

async function fetchLatestVersion(): Promise<string> {
  const { default: https } = await import('https');
  return new Promise((resolve, reject) => {
    const req = https.get(REGISTRY_URL, { headers: { 'User-Agent': `devassets-cli` } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const { version } = JSON.parse(body) as { version: string };
          resolve(version);
        } catch {
          reject(new Error('parse error'));
        }
      });
    });
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

function printUpdateWarning(current: string, latest: string): void {
  // Print to stderr so it doesn't pollute --format=json stdout captures
  process.stderr.write(
    `\n  Update available: ${current} → ${latest}\n` +
    `  Run: npm install -g ${PACKAGE_NAME}\n\n`,
  );
}
