#!/usr/bin/env node
// Guards against README claiming CLI commands / MCP tools / identity providers that don't
// actually exist in src/ (or vice versa) — this class of drift shipped silently for a month
// (`devassets ui`, Stripe/Paddle "identity" resolution, undocumented devassets_set_secret)
// before being caught by manual audit. Runs on every release via `prepublishOnly` and in CI.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf-8');

const errors = [];
const warnings = [];

// ---- 1. CLI commands: README `devassets <word>` refs vs actual `program.command('word ...')` ----
const cliSource = read('src/cli.ts');
const realCommands = new Set(
  [...cliSource.matchAll(/\.command\(['"]([a-z][\w-]*)/g)].map((m) => m[1])
);

const readme = read('README.md');
const readmeCommandRefs = new Set(
  // Negative lookbehind excludes `@hyphen-network/devassets` (npm package name) so its trailing
  // "devassets" doesn't get treated as the command token and swallow the next line's word.
  [...readme.matchAll(/(?<![\w/])devassets\s+([a-z][\w-]*)/g)].map((m) => m[1])
);

for (const name of readmeCommandRefs) {
  if (!realCommands.has(name)) {
    errors.push(`README references \`devassets ${name}\`, but no such command exists in src/cli.ts (real commands: ${[...realCommands].sort().join(', ')})`);
  }
}
for (const name of realCommands) {
  if (!readmeCommandRefs.has(name)) {
    warnings.push(`\`devassets ${name}\` exists in src/cli.ts but isn't mentioned anywhere in README.md`);
  }
}

// ---- 2. MCP tools: README `devassets_word` refs vs actual `server.tool('devassets_word', ...)` ----
const serverSource = read('src/mcp/server.ts');
const realTools = new Set(
  [...serverSource.matchAll(/server\.tool\(\s*\n?\s*['"](devassets_[a-zA-Z_]+)['"]/g)].map((m) => m[1])
);

const readmeToolRefs = new Set([...readme.matchAll(/devassets_[a-zA-Z_]+/g)].map((m) => m[0]));

for (const name of readmeToolRefs) {
  if (!realTools.has(name)) {
    errors.push(`README references MCP tool \`${name}\`, but no such tool is registered in src/mcp/server.ts`);
  }
}
for (const name of realTools) {
  if (!readmeToolRefs.has(name)) {
    warnings.push(`MCP tool \`${name}\` is registered in src/mcp/server.ts but isn't mentioned anywhere in README.md`);
  }
}

// ---- 3. Identity providers: README "Supported providers" table vs providers/index.ts registry ----
const providersSource = read('src/integrations/providers/index.ts');
const realProviders = new Set(
  [...providersSource.matchAll(/provider:\s*['"](\w+)['"]/g)].map((m) => m[1])
);

const headingIndex = readme.indexOf('**Supported providers**');
const linesAfterHeading = headingIndex === -1 ? [] : readme.slice(headingIndex).split('\n');
const tableStart = linesAfterHeading.findIndex((line) => line.startsWith('|'));
const tableLines = [];
for (let i = tableStart; i !== -1 && i < linesAfterHeading.length; i++) {
  if (!linesAfterHeading[i].startsWith('|')) break;
  tableLines.push(linesAfterHeading[i]);
}

if (tableLines.length) {
  const rows = tableLines
    .map((line) => line.match(/^\| ([A-Za-z][A-Za-z /]*) \|/)?.[1])
    .filter((cell) => cell && cell !== 'Provider'); // drop header/separator/non-matching rows
  for (const cell of rows) {
    const names = cell.split('/').map((s) => s.trim().toLowerCase().replace(/\s+/g, ''));
    for (const name of names) {
      const normalized = name === 'googlecloud' ? 'gcloud' : name;
      if (!realProviders.has(normalized)) {
        errors.push(`README's identity table lists "${cell.trim()}" as a supported provider, but "${normalized}" has no entry in src/integrations/providers/index.ts (real providers: ${[...realProviders].sort().join(', ')})`);
      }
    }
  }
} else {
  warnings.push('Could not find the "**Supported providers**" table in README.md — identity provider sync was not checked');
}

// ---- report ----
for (const w of warnings) console.warn(`[docs-sync] WARN: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`[docs-sync] ERROR: ${e}`);
  console.error(`\n[docs-sync] ${errors.length} error(s) — README.md is out of sync with src/. Fix before publishing.`);
  process.exit(1);
}
console.log(`[docs-sync] OK (${warnings.length} warning(s))`);
