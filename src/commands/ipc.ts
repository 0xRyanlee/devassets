import { listVaultSecrets, getVaultSecret, setVaultSecret, deleteVaultSecret, upsertProject } from '../db/queries.js';
import type { SecretScope } from '../types/index.js';

interface IpcRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface IpcResponse {
  id: string;
  result?: unknown;
  error?: string;
}

function dispatch(req: IpcRequest): unknown {
  const p = req.params;

  switch (req.method) {
    case 'list_secrets': {
      const projectId = p['project_id'] as string;
      const env = p['env'] as string | undefined;
      return listVaultSecrets(projectId, env);
    }

    case 'get_secret_value': {
      const projectId = p['project_id'] as string;
      const env = (p['env'] as string) ?? 'local';
      const key = p['key'] as string;
      const value = getVaultSecret(projectId, env, key);
      if (value === undefined) throw new Error(`Secret not found: ${key}`);
      return { value };
    }

    case 'set_secret': {
      const projectId = p['project_id'] as string;
      const env = (p['env'] as string) ?? 'local';
      const key = p['key'] as string;
      const value = p['value'] as string;
      const scope: SecretScope = projectId === '_global' ? 'global' : 'project';
      setVaultSecret(projectId, env, key, value, {
        provider: p['provider'] as string | undefined,
        account: p['account'] as string | undefined,
      }, scope);
      return { ok: true };
    }

    case 'delete_secret': {
      const projectId = p['project_id'] as string;
      const env = (p['env'] as string) ?? 'local';
      const key = p['key'] as string;
      const deleted = deleteVaultSecret(projectId, env, key);
      return { ok: true, deleted };
    }

    case 'register_project': {
      const id = p['project_id'] as string;
      const name = (p['name'] as string) ?? id;
      const path = (p['path'] as string) ?? '';
      const type_ = (p['type'] as string) ?? 'other';
      upsertProject({ id, name, path, type: type_ as 'saas' | 'mobile' | 'desktop' | 'library' | 'other' });
      return { ok: true };
    }

    default:
      throw new Error(`Unknown method: ${req.method}`);
  }
}

export function ipcCommand() {
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.resume();

  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let req: IpcRequest;
      try {
        req = JSON.parse(trimmed);
      } catch {
        process.stdout.write(JSON.stringify({ id: '', error: 'Invalid JSON' }) + '\n');
        continue;
      }

      let resp: IpcResponse;
      try {
        resp = { id: req.id, result: dispatch(req) };
      } catch (err) {
        resp = { id: req.id, error: err instanceof Error ? err.message : String(err) };
      }
      process.stdout.write(JSON.stringify(resp) + '\n');
    }
  });

  process.stdin.on('end', () => process.exit(0));
}
