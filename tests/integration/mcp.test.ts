import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Exercises the actual MCP server over the real stdio JSON-RPC protocol (not just the underlying
// TS functions) — this is the only way to cover server.ts's tool-handler-level guards, since
// several of them (devassets_add_project's home-dir block, devassets_export's path sanitization)
// live entirely inside server.ts and aren't reachable through the CLI at all.

const CLI = path.resolve('./dist/index.js');
const TMP = path.join(os.tmpdir(), 'devassets-mcp-test');
const PROJECT_PATH = path.join(TMP, 'mcpproject');
const PROJECT2_PATH = path.join(TMP, 'mcpproject2');

let client: Client;

function run(args: string) {
  execFileSync('node', [CLI, ...args.split(' ')], { env: { ...process.env, HOME: TMP } });
}

function textOf(result: any): any {
  return JSON.parse(result.content[0].text);
}

beforeAll(async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(PROJECT_PATH, { recursive: true });
  fs.mkdirSync(PROJECT2_PATH, { recursive: true });
  fs.writeFileSync(path.join(PROJECT_PATH, '.env'), 'DATABASE_URL=postgres://x\n');

  run('init');
  run(`add-project mcpproject --path=${PROJECT_PATH} --type=saas`);
  run(`add-project mcpproject2 --path=${PROJECT2_PATH} --type=saas`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: [CLI, 'serve'],
    env: { ...process.env, HOME: TMP },
  });
  client = new Client({ name: 'devassets-test-client', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
}, 20_000);

afterAll(async () => {
  await client?.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('MCP server: basic connectivity', () => {
  it('lists the registered projects', async () => {
    const result = await client.callTool({ name: 'devassets_list_projects', arguments: {} });
    const projects = textOf(result);
    expect(projects.some((p: { id: string }) => p.id === 'mcpproject')).toBe(true);
  });
});

describe('MCP server: devassets_resolve_project', () => {
  it('resolves a cwd inside a registered project', async () => {
    const result = await client.callTool({ name: 'devassets_resolve_project', arguments: { cwd: path.join(PROJECT_PATH, 'src') } });
    const data = textOf(result);
    expect(data.found).toBe(true);
    expect(data.project.id).toBe('mcpproject');
  });

  it('reports not found for an unregistered directory', async () => {
    const result = await client.callTool({ name: 'devassets_resolve_project', arguments: { cwd: os.tmpdir() } });
    expect(textOf(result).found).toBe(false);
  });
});

describe('MCP server: devassets_add_project sensitive-path guard', () => {
  it('refuses to register the home directory itself', async () => {
    const result = await client.callTool({ name: 'devassets_add_project', arguments: { id: 'homehack', name: 'homehack', path: TMP } });
    expect(textOf(result).error).toContain('home directory');
  });
});

describe('MCP server: vault secrets', () => {
  it('stores and retrieves a project-scoped secret', async () => {
    await client.callTool({ name: 'devassets_set_secret', arguments: { project: 'mcpproject', key: 'MCP_TEST_KEY', value: 'hello-mcp' } });
    const result = await client.callTool({ name: 'devassets_get_secret', arguments: { project: 'mcpproject', key: 'MCP_TEST_KEY' } });
    const data = textOf(result);
    expect(data.found).toBe(true);
    expect(data.value).toBe('hello-mcp');
  });

  it('does not fall back to an unrelated project for a key only stored there', async () => {
    await client.callTool({ name: 'devassets_set_secret', arguments: { project: 'mcpproject2', key: 'ONLY_IN_PROJECT2', value: 'secret2' } });
    const result = await client.callTool({ name: 'devassets_get_secret', arguments: { project: 'mcpproject', key: 'ONLY_IN_PROJECT2' } });
    expect(textOf(result).found).toBe(false);
  });
});

describe('MCP server: devassets_export path handling', () => {
  it('generates a manifest without escaping cwd even with a path-traversal-looking environment value', async () => {
    const result = await client.callTool({
      name: 'devassets_export',
      arguments: { project: 'mcpproject', environment: '../../../../tmp/evil', format: 'manifest' },
    });
    const data = textOf(result);
    expect(data.error).toBeUndefined();
    const outputPath = path.resolve(data.outputPath);
    expect(outputPath.startsWith(process.cwd() + path.sep)).toBe(true);
    fs.rmSync(outputPath, { force: true });
  });
});

describe('MCP server: devassets_export encryption guard', () => {
  it('returns an error instead of writing plaintext when encrypt=true has no encrypt_for', async () => {
    const result = await client.callTool({
      name: 'devassets_export',
      arguments: { project: 'mcpproject', environment: 'mcp-encrypt-test', format: 'manifest', encrypt: true },
    });
    const data = textOf(result);
    expect(data.error).toContain('encrypt-for');
    expect(data.outputPath).toBeUndefined();
  });
});
