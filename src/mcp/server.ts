import fs from 'fs';
import path from 'path';
import os from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getProject, getAssets, getPaymentPlatforms, getAuditLogs, listProjects, upsertProject, addAuditLog, getCurrentUser, listVaultSecrets, getVaultSecret, setVaultSecret, getGlobalSecret, findSecretAcrossProjects, getVaultSecretFallback, persistPaymentStatuses } from '../db/queries.js';
import { scanProject } from '../core/scanner.js';
import { readProjectEnvValue } from '../core/roots.js';
import { validateAssets, mergePaymentRisks } from '../core/validator.js';
import { exportManifest, generateOutputPath } from '../core/exporter.js';
import { checkPaddleStatus } from '../integrations/paddle.js';
import { checkStripeStatus } from '../integrations/stripe.js';
import { buildDoctorReport } from '../commands/doctor.js';
import { generateCiSnippet } from '../core/ci.js';
import { DEFAULT_ENV } from '../utils/constants.js';
import { VERSION } from '../utils/version.js';
import { realOrResolved } from '../utils/fs-safety.js';

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;

function textResult(data: unknown, pretty = false) {
  return { content: [{ type: 'text' as const, text: pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data) }] };
}

function notFound(projectId: string) {
  return textResult({ error: `Project not found: ${projectId}` });
}

export async function startMcpServer() {
  // Mirrors src/index.ts's CLI guard: if the MCP host disconnects mid-write (client process
  // exited, pipe closed), stdout emits EPIPE — exit cleanly instead of an unhandled crash.
  process.stdout.on('error', (err: NodeJS.ErrnoException) => { if (err.code === 'EPIPE') process.exit(0); });

  const server = new McpServer({
    name: 'devassets',
    version: VERSION,
  });

  server.tool(
    'devassets_list_projects',
    'List all registered projects and their health status',
    {},
    async () => {
      const projects = listProjects().filter(p => p.id !== '_global');
      if (projects.length === 0) {
        return textResult({ projects: [], message: 'No projects registered. Run: devassets add-project <name> --path=<path>' });
      }
      const enriched = projects.map(p => {
        const assets = getAssets(p.id);
        const result = validateAssets(assets, p.id, undefined, p.type);
        return { id: p.id, name: p.name, path: p.path, type: p.type, status: result.status, assetCount: assets.length };
      });
      return textResult(enriched, true);
    }
  );

  server.tool(
    'devassets_resolve_project',
    'Resolve which registered project a working directory belongs to, by matching cwd against each project\'s registered path. Use this instead of devassets_list_projects + manual path comparison when you know the current directory but not the project ID.',
    {
      cwd: z.string().describe('Absolute path to resolve (e.g. the calling agent\'s current working directory)'),
    },
    async ({ cwd }) => {
      const resolved = realOrResolved(cwd);
      const projects = listProjects().filter(p => p.id !== '_global');
      const matches = projects.filter(p => {
        const projectPath = realOrResolved(p.path);
        return resolved === projectPath || resolved.startsWith(projectPath + path.sep);
      });
      if (matches.length === 0) {
        return textResult({ found: false, cwd: resolved, message: 'No registered project contains this directory. Run devassets_add_project to register it.' });
      }
      // If both a parent and a nested project are registered (e.g. /repo and /repo/app), the
      // most specific (longest/deepest path) match is the right one, not registration order.
      const match = matches.reduce((best, p) => p.path.length > best.path.length ? p : best);
      return textResult({ found: true, cwd: resolved, project: { id: match.id, name: match.name, path: match.path, type: match.type } });
    }
  );

  server.tool(
    'devassets_check',
    'Check project asset status and risks',
    {
      project: z.string().describe('Project ID'),
      environment: z.string().optional().describe('Environment: development | staging | production'),
    },
    async ({ project: projectId, environment }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);

      const assets = getAssets(projectId, environment);
      let result = validateAssets(assets, projectId, environment, project.type);

      const platforms = getPaymentPlatforms(projectId);
      const paymentStatuses = [];
      // Default to 'production' for payment key lookups when no env specified —
      // payment integrations are most meaningful against production credentials.
      const vaultEnv = environment ?? 'production';
      for (const p of platforms) {
        if (p.name === 'paddle') {
          const key = readProjectEnvValue(project.path, 'PADDLE_API_KEY')
            || process.env.PADDLE_API_KEY
            || getVaultSecretFallback(projectId, vaultEnv, 'PADDLE_API_KEY')?.value;
          paymentStatuses.push(await checkPaddleStatus(projectId, key));
        } else if (p.name === 'stripe') {
          const key = readProjectEnvValue(project.path, 'STRIPE_SECRET_KEY')
            || process.env.STRIPE_SECRET_KEY
            || getVaultSecretFallback(projectId, vaultEnv, 'STRIPE_SECRET_KEY')?.value;
          paymentStatuses.push(await checkStripeStatus(projectId, key));
        }
      }
      if (paymentStatuses.length > 0) {
        result = mergePaymentRisks(result, paymentStatuses);
        persistPaymentStatuses(projectId, paymentStatuses, result.timestamp);
      }

      // Annotate missing assets with vault location hints for agent discoverability
      const vaultHints: Record<string, string> = {};
      for (const asset of result.categories.environmentVariables.filter(a => a.status === 'missing')) {
        const matches = findSecretAcrossProjects(asset.name);
        if (matches.length > 0) {
          vaultHints[asset.name] = matches.map(m => `vault:${m.projectId}[${m.env}]`).join(', ');
        }
      }
      if (Object.keys(vaultHints).length > 0) {
        (result as unknown as Record<string, unknown>).vaultHints = vaultHints;
      }

      addAuditLog({ projectId, action: 'check', user: getCurrentUser(), timestamp: result.timestamp, details: { environment, via: 'mcp' }, result: 'success' });

      return textResult(result, true);
    }
  );

  server.tool(
    'devassets_scan',
    'Scan project environment files and update asset records',
    {
      project: z.string().describe('Project ID'),
    },
    async ({ project: projectId }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);

      const { replaceAssets, ensurePaymentPlatformDetected } = await import('../db/queries.js');
      let scanResult;
      try {
        scanResult = scanProject(projectId, project.path);
        replaceAssets(projectId, scanResult.assets);
        for (const platform of scanResult.detectedPlatforms) {
          ensurePaymentPlatformDetected(projectId, platform);
        }
      } catch (err) {
        addAuditLog({ projectId, action: 'scan', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { via: 'mcp', error: err instanceof Error ? err.message : String(err) }, result: 'failure' });
        return textResult({ error: err instanceof Error ? err.message : String(err) });
      }
      addAuditLog({ projectId, action: 'scan', user: getCurrentUser(), timestamp: scanResult.scannedAt, details: { via: 'mcp', assetsFound: scanResult.assets.length }, result: 'success' });

      return textResult({ assetsFound: scanResult.assets.length, envFiles: scanResult.envFilesFound, platforms: scanResult.detectedPlatforms });
    }
  );

  server.tool(
    'devassets_export',
    'Export a signed asset manifest for a project',
    {
      project: z.string().describe('Project ID'),
      environment: z.string().optional().describe('Environment (default: production)'),
      format: z.enum(['manifest', 'checklist', 'reference-only']).optional().describe('Output format (default: manifest)'),
      encrypt: z.boolean().optional().describe('Encrypt the manifest'),
      encrypt_for: z.string().optional().describe('Password or recipient identifier for encryption'),
      output_path: z.string().optional().describe('File path to save the manifest'),
    },
    async ({ project: projectId, environment = 'production', format = 'manifest', encrypt, encrypt_for, output_path }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);

      if (output_path) {
        const resolved = path.resolve(output_path);
        const cwd = path.resolve(process.cwd());
        if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
          return textResult({ error: `output_path must be within current working directory` });
        }
        // Resolve symlinks on the parent directory to prevent symlink traversal attacks
        try {
          const parentReal = fs.realpathSync(path.dirname(resolved));
          const cwdReal = fs.realpathSync(cwd);
          if (!parentReal.startsWith(cwdReal + path.sep) && parentReal !== cwdReal) {
            return textResult({ error: `output_path resolves outside current working directory via symlink` });
          }
        } catch {
          return textResult({ error: `output_path parent directory does not exist` });
        }
      }

      const assets = getAssets(projectId, environment);
      const checkResult = validateAssets(assets, projectId, environment, project.type);
      // generateOutputPath sanitizes project/environment internally, so even when output_path is
      // omitted the auto-generated filename can't escape cwd via a crafted environment value.
      const outputPath = output_path ?? generateOutputPath(projectId, environment, format);

      let result;
      try {
        result = exportManifest(checkResult, {
          project: projectId, environment, format, encrypt, encryptFor: encrypt_for, outputPath,
        });
      } catch (err) {
        addAuditLog({ projectId, action: 'export', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { environment, format, via: 'mcp', error: err instanceof Error ? err.message : String(err) }, result: 'failure' });
        return textResult({ error: err instanceof Error ? err.message : String(err) });
      }

      addAuditLog({ projectId, action: 'export', user: getCurrentUser(), timestamp: result.timestamp, details: { environment, format, encrypted: result.encrypted, via: 'mcp' }, result: 'success' });

      // preview omitted: plaintext manifest content must not be returned in MCP response unencrypted
      return textResult({ signature: result.signature, timestamp: result.timestamp, encrypted: result.encrypted, outputPath: result.outputPath, autoDecision: result.autoDecision });
    }
  );

  server.tool(
    'devassets_health',
    'Get a quick health summary across all projects or a specific project',
    {
      project: z.string().optional().describe('Project ID (omit for all projects)'),
      focus: z.string().optional().describe('Focus area: payments | env | webhooks'),
    },
    async ({ project: projectId, focus }) => {
      const projects = projectId ? [getProject(projectId)].filter(Boolean) : listProjects().filter(p => p.id !== '_global');
      if (projects.length === 0) {
        return textResult({ projects: [], message: projectId ? `Project not found: ${projectId}` : 'No projects registered. Run: devassets add-project <name> --path=<path>' });
      }
      const summaries = projects.map(p => {
        if (!p) return null;
        const assets = getAssets(p.id);
        const result = validateAssets(assets, p.id, undefined, p.type);
        const topRisks = result.risks
          .filter(r => !focus || r.asset.toLowerCase().includes(focus.toLowerCase()))
          .slice(0, 3);
        return { id: p.id, name: p.name, status: result.status, criticalCount: result.risks.filter(r => r.level === 'critical').length, topRisks };
      }).filter(Boolean);

      return textResult(summaries, true);
    }
  );

  server.tool(
    'devassets_audit',
    'Get audit log for a project',
    {
      project: z.string().describe('Project ID'),
      since_days: z.number().optional().describe('Number of days to look back (default: 7)'),
      action: z.string().optional().describe('Filter by action type: scan | check | export | rotate | verify'),
    },
    async ({ project: projectId, since_days = 7, action }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);

      let logs = getAuditLogs(projectId, since_days);
      if (action) logs = logs.filter(l => l.action === action);
      return textResult(logs, true);
    }
  );

  server.tool(
    'devassets_rotate',
    'Record intent to rotate an API key and get rotation instructions',
    {
      project: z.string().describe('Project ID'),
      key_name: z.string().max(256).regex(/^[A-Z_][A-Z0-9_]*$/, 'Key name must be uppercase with underscores').describe('Key name to rotate (e.g. PADDLE_API_KEY)'),
    },
    async ({ project: projectId, key_name }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);

      addAuditLog({ projectId, action: 'rotate', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { keyName: key_name, status: 'initiated', via: 'mcp' }, result: 'success' });

      const isGlobal = projectId === '_global';
      const storeStep = isGlobal
        ? `Store the new value via MCP: call devassets_set_global_secret(key="${key_name}", value="<new-value>")`
        : `Store the new value via MCP: call devassets_set_secret(project="${projectId}", key="${key_name}", value="<new-value>") — or CLI: devassets set ${projectId} ${key_name}`;
      const steps = [
        `Generate a new ${key_name} in the relevant service dashboard`,
        storeStep,
        'Deploy to pick up the new value',
        ...(!isGlobal ? [`Run: devassets scan ${projectId}  (to record the .env change)`] : []),
      ];
      const instructions = {
        key: key_name,
        project: projectId,
        scope: isGlobal ? 'global' : 'project',
        status: 'rotation_initiated',
        steps,
        auditRecorded: true,
      };

      return textResult(instructions, true);
    }
  );

  server.tool(
    'devassets_add_project',
    'Register a new project with DevAssets',
    {
      id: z.string().max(256).regex(PROJECT_ID_PATTERN, 'Project ID must be alphanumeric with -, _, or . only').describe('Project slug ID (e.g. legita, sparkie)'),
      name: z.string().describe('Human-readable project name'),
      path: z.string().describe('Absolute path to the project directory'),
      type: z.enum(['saas', 'mobile', 'desktop', 'library', 'other']).optional().describe('Project type'),
    },
    async ({ id, name, path: projectPath, type = 'other' }) => {
      if (id === '_global') {
        return textResult({ error: `"_global" is a reserved project ID for account-level credentials. Use devassets_set_global_secret to store global keys.` });
      }
      let resolvedPath: string;
      try {
        const stat = fs.statSync(path.resolve(projectPath));
        if (!stat.isDirectory()) throw new Error('Not a directory');
        // Canonicalize (follow symlinks) so both the guard below and the path actually stored in
        // the DB reflect the real directory — a `/tmp/link -> $HOME` symlink would otherwise pass
        // a lexical containment check while every subsequent scan walks the real $HOME through it.
        resolvedPath = fs.realpathSync(path.resolve(projectPath));
      } catch {
        return textResult({ error: `Path does not exist or is not a directory: ${projectPath}` });
      }
      // Block registering the home directory itself or anything above it — a blacklist of
      // specific dotfile dirs (~/.ssh etc.) doesn't stop e.g. registering all of $HOME, which
      // would let a subsequent devassets_scan walk every unrelated project on the machine.
      const home = fs.realpathSync(os.homedir());
      const isHomeOrAncestor = resolvedPath === home || home === resolvedPath || home.startsWith(resolvedPath + path.sep);
      const isFilesystemRoot = resolvedPath === path.parse(resolvedPath).root;
      const sensitiveRoots = ['/.ssh', '/.gnupg', '/.aws', '/.config/gcloud'];
      const isSensitiveDotdir = sensitiveRoots.some(s => resolvedPath.includes(s));
      if (isHomeOrAncestor || isFilesystemRoot || isSensitiveDotdir) {
        return textResult({ error: `Registering this path is not allowed (your home directory, a parent of it, the filesystem root, or a sensitive credential directory): ${projectPath}` });
      }
      upsertProject({ id, name, path: resolvedPath, type });
      return textResult({ registered: true, id, name, path: resolvedPath, type, next: `devassets_scan with project=${id}` });
    }
  );

  server.tool(
    'devassets_identity',
    'Resolve which account/workspace/project each provider token in a project belongs to (Vercel, Supabase, Neon, npm, Google Cloud). Detects wrong-account / workspace-mismatch issues. Token values are read transiently and never stored.',
    {
      project: z.string().describe('Project ID'),
    },
    async ({ project: projectId }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);
      const { resolveProjectIdentities } = await import('../core/identity.js');
      const identities = await resolveProjectIdentities(project);
      addAuditLog({ projectId, action: 'identity', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { resolved: identities.length, via: 'mcp' }, result: 'success' });
      return textResult(identities, true);
    }
  );

  server.tool(
    'devassets_doctor',
    'Global health report across all registered projects',
    {
      json: z.boolean().optional().describe('Return raw JSON report instead of summary'),
    },
    async ({ json: asJson }) => {
      const projects = listProjects();
      if (projects.length === 0) {
        return textResult({ message: 'No projects registered.' });
      }
      const report = buildDoctorReport(projects);
      if (asJson) {
        return textResult(report, true);
      }
      const summary = {
        generatedAt: report.generatedAt,
        summary: report.summary,
        topRisks: report.topRisks.slice(0, 5),
        recentActivity: report.recentActivity.slice(0, 5),
        projects: report.projects.map(p => ({ id: p.id, name: p.name, status: p.status, riskCount: p.riskCount })),
      };
      return textResult(summary, true);
    }
  );

  server.tool(
    'devassets_ci_snippet',
    'Generate a GitHub Actions workflow YAML snippet to integrate devassets into a project\'s CI pipeline. The workflow gates deployments: CI fails if asset risks are detected.',
    {
      project: z.string().describe('Project ID to generate CI snippet for'),
      branch: z.string().optional().describe('Branch to run checks on (default: main)'),
      environment: z.string().optional().describe('Environment to check (default: production)'),
    },
    async ({ project: projectId, branch = 'main', environment = 'production' }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);

      const snippet = generateCiSnippet(projectId, branch, environment);
      const installHint = [
        `# How to use devassets CI for "${project.name}"`,
        '',
        '## Option A — Reusable workflow (recommended)',
        'Create .github/workflows/devassets.yml in your target repo:',
        '',
        snippet.reusable,
        '',
        '## Option B — Standalone workflow (no devassets repo dependency)',
        '',
        snippet.standalone,
        '',
        '## Notes',
        '- Requires GitHub token with workflow scope to push: gh auth refresh -h github.com -s workflow',
        '- --fail-on-risk exits 1 when status is warning or critical, blocking the deploy',
        `- Skipping /devassets-ci skill in Claude Code also automates this setup`,
      ].join('\n');

      return { content: [{ type: 'text' as const, text: installHint }] };
    }
  );

  server.tool(
    'devassets_skills',
    'Return available Claude Code skill definitions for devassets. Install these as ~/.claude/commands/<name>.md to enable /devassets-check and /devassets-ci slash commands.',
    {
      skill: z.enum(['devassets-check', 'devassets-ci', 'all']).optional().describe('Which skill to return (default: all)'),
    },
    async ({ skill = 'all' }) => {
      const { readSkillContent } = await import('./skills.js');
      const skills = skill === 'all'
        ? { 'devassets-check': readSkillContent('devassets-check'), 'devassets-ci': readSkillContent('devassets-ci') }
        : { [skill]: readSkillContent(skill) };
      const installPath = `${process.env.HOME}/.claude/commands/`;
      return textResult({ installPath, skills, installCommand: 'devassets install-skills' }, true);
    }
  );

  server.tool(
    'devassets_find_secret',
    'Search across ALL projects\' vaults for a key name. Returns metadata (project, env, scope, provider, updatedAt) — never plaintext values. Use scope=global to find only account-level shared credentials; scope=project for project-specific keys.',
    {
      key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'Key name must be uppercase with underscores').describe('Key name to search for (e.g. PADDLE_API_KEY)'),
      env: z.string().optional().describe('Filter by environment: local | development | staging | production'),
      scope: z.enum(['global', 'project']).optional().describe('Filter by scope: global = account-level credentials shared across projects; project = project-specific credentials'),
    },
    async ({ key, env, scope }) => {
      const matches = findSecretAcrossProjects(key, env, scope);
      if (matches.length === 0) {
        const hint = scope === 'global'
          ? `Use devassets_set_global_secret to store ${key} as a global credential.`
          : `Use devassets set <project> ${key} to store it.`;
        return textResult({ found: false, key, message: `No vault entry found for ${key}${env ? ` [${env}]` : ''}${scope ? ` [scope=${scope}]` : ''}. ${hint}` });
      }
      return textResult({ found: true, key, matches });
    }
  );

  server.tool(
    'devassets_list_secrets',
    'List vault secrets for a project. Returns metadata only (key names, env, scope, provider, updatedAt) — never plaintext values. Use project="_global" or scope="global" to list account-level credentials shared across all projects.',
    {
      project: z.string().describe('Project ID. Use "_global" to list account-level credentials shared across all projects.'),
      env: z.string().optional().describe('Filter by environment (default: all environments)'),
      scope: z.enum(['global', 'project']).optional().describe('Filter by scope: global = account-level shared credentials; project = project-specific credentials'),
    },
    async ({ project: projectId, env, scope }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);
      const secrets = listVaultSecrets(projectId, env, scope);
      return textResult({ project: projectId, count: secrets.length, secrets });
    }
  );

  server.tool(
    'devassets_get_secret',
    'Retrieve a project-scoped secret from the vault. Searches the specified project first, then the _global vault. For account-level credentials shared across projects (VERCEL_TOKEN, ANTHROPIC_API_KEY, GitHub PATs), prefer devassets_get_global_secret which searches only the global scope. WARNING: the returned value is plaintext and will appear in this conversation/transcript — the calling agent should avoid echoing it back to the user and should redact it in any logs it keeps.',
    {
      project: z.string().describe('Primary project ID to look up first'),
      key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'Key name must be uppercase with underscores').describe('Key name (e.g. PADDLE_API_KEY)'),
      env: z.string().optional().describe('Environment (default: local)'),
    },
    async ({ project: projectId, key, env = DEFAULT_ENV }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);

      const result = getVaultSecretFallback(projectId, env, key);
      if (!result) {
        // findSecretAcrossProjects here is a discoverability hint only — its matches are never
        // used as the returned value, so a project can't silently receive another project's secret.
        const elsewhere = findSecretAcrossProjects(key);
        const altEnvs = [...new Set(elsewhere.map(m => m.env))].filter(e => e !== env);
        const message = altEnvs.length > 0
          ? `${key} exists under env=${altEnvs.join(',')} but you queried env=${env}. Add --env ${altEnvs[0]} or omit to use the default (${DEFAULT_ENV}).`
          : `${key} not found in any vault for env=${env}. Run: devassets set ${projectId} ${key} --env ${env}`;
        return textResult({ found: false, key, env, alternateEnvs: elsewhere.map(m => ({ env: m.env, project: m.projectId })), message });
      }

      addAuditLog({ projectId, action: 'get', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { key, env, sourceProject: result.sourceProject, scope: result.scope, via: 'mcp' }, result: 'success' });

      return textResult({ found: true, key, env, value: result.value, sourceProject: result.sourceProject, scope: result.scope });
    }
  );

  server.tool(
    'devassets_get_global_secret',
    'Retrieve an account-level credential from the global vault. Use this for credentials shared across multiple projects: VERCEL_TOKEN, ANTHROPIC_API_KEY, GitHub PATs, STRIPE_SECRET_KEY (when shared), etc. Does not require a project context. Returns the plaintext value. WARNING: the returned value is plaintext and will appear in this conversation/transcript — the calling agent should avoid echoing it back to the user and should redact it in any logs it keeps.',
    {
      key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'Key name must be uppercase with underscores').describe('Key name (e.g. VERCEL_TOKEN)'),
      env: z.string().optional().describe('Environment (default: local)'),
    },
    async ({ key, env = DEFAULT_ENV }) => {
      let value: string | undefined;
      try {
        value = getGlobalSecret(key, env);
      } catch (err) {
        return textResult({ found: false, key, env, error: err instanceof Error ? err.message : String(err) });
      }

      if (!value) {
        const elsewhere = findSecretAcrossProjects(key);
        const altEnvs = [...new Set(elsewhere.map(m => m.env))].filter(e => e !== env);
        const message = altEnvs.length > 0
          ? `${key} exists under env=${altEnvs.join(',')} but you queried env=${env}. Specify env explicitly.`
          : `${key} not found in global vault [${env}]. Store it with: devassets_set_global_secret(key="${key}", value="<secret>")`;
        return textResult({ found: false, key, env, scope: 'global', alternateEnvs: elsewhere.map(m => ({ env: m.env, project: m.projectId })), message });
      }

      addAuditLog({ projectId: '_global', action: 'get', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { key, env, scope: 'global', via: 'mcp' }, result: 'success' });

      return textResult({ found: true, key, env, value, scope: 'global', sourceProject: '_global' });
    }
  );

  server.tool(
    'devassets_set_global_secret',
    'Store an account-level credential in the global vault. Use for credentials shared across multiple projects: VERCEL_TOKEN, ANTHROPIC_API_KEY, GitHub PATs, etc. Does not require a project context. Stored once, accessible from any project via devassets_get_global_secret.',
    {
      key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'Key name must be uppercase with underscores').describe('Key name (e.g. VERCEL_TOKEN)'),
      value: z.string().min(1).max(65536).describe('The secret value to store'),
      env: z.string().optional().describe('Environment (default: local)'),
      provider: z.string().optional().describe('Provider hint (e.g. vercel, anthropic, github)'),
      account: z.string().optional().describe('Account/email hint for identity tracking'),
    },
    async ({ key, value, env = DEFAULT_ENV, provider, account }) => {
      setVaultSecret('_global', env, key, value, { provider, account }, 'global');

      addAuditLog({ projectId: '_global', action: 'set', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { key, env, scope: 'global', via: 'mcp' }, result: 'success' });

      return textResult({ stored: true, key, env, scope: 'global', message: `${key} stored in global vault [${env}]. Accessible via devassets_get_global_secret.` });
    }
  );

  server.tool(
    'devassets_set_secret',
    'Store a project-scoped secret in the vault. Use this for credentials specific to one project (API keys, DB passwords, tokens). For credentials shared across multiple projects, use devassets_set_global_secret instead.',
    {
      project: z.string().describe('Project ID to store the secret under'),
      key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'Key name must be uppercase with underscores').describe('Key name (e.g. DATABASE_URL)'),
      value: z.string().min(1).max(65536).describe('The secret value to store'),
      env: z.string().optional().describe('Environment (default: local)'),
      provider: z.string().optional().describe('Provider hint (e.g. supabase, neon, stripe)'),
      account: z.string().optional().describe('Account/email hint for identity tracking'),
    },
    async ({ project: projectId, key, value, env = DEFAULT_ENV, provider, account }) => {
      const project = getProject(projectId);
      if (!project) return notFound(projectId);

      setVaultSecret(projectId, env, key, value, { provider, account }, 'project');

      addAuditLog({ projectId, action: 'set', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { key, env, scope: 'project', via: 'mcp' }, result: 'success' });

      return textResult({ stored: true, key, env, project: projectId, scope: 'project', message: `${key} stored in project vault [${projectId}/${env}]. Retrieve with devassets_get_secret.` });
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
