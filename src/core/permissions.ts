import fs from 'fs';
import yaml from 'js-yaml';
import { PERMISSIONS_PATH } from '../utils/constants.js';
import type { Permission } from '../types/index.js';

interface PermissionsConfig {
  permissions: Permission[];
}

const DEFAULT_PERMISSIONS: PermissionsConfig = {
  permissions: [
    { role: 'owner', actions: ['*'], projects: ['*'] },
  ],
};

function loadPermissions(): PermissionsConfig {
  if (!fs.existsSync(PERMISSIONS_PATH)) return DEFAULT_PERMISSIONS;
  try {
    const content = fs.readFileSync(PERMISSIONS_PATH, 'utf-8');
    return yaml.load(content) as PermissionsConfig;
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

// TODO: wire up at MCP/CLI command entry points to enforce per-project role gates
export function canPerformAction(action: string, projectId: string): boolean {
  const config = loadPermissions();
  const user = process.env.USER ?? 'owner';

  for (const perm of config.permissions) {
    const projectMatch = !perm.projects || perm.projects.includes('*') || perm.projects.includes(projectId);
    const actionMatch = perm.actions.includes('*') || perm.actions.includes(action);
    if (projectMatch && actionMatch) return true;
  }

  return false;
}

export function initPermissionsFile() {
  if (fs.existsSync(PERMISSIONS_PATH)) return;
  fs.writeFileSync(PERMISSIONS_PATH, yaml.dump(DEFAULT_PERMISSIONS), 'utf-8');
}
