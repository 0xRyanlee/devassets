import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getProject, getAssets, getPaymentPlatforms, getAuditLogs, listProjects, upsertProject, addAuditLog, getCurrentUser } from '../db/queries.js';
import { scanProject } from '../core/scanner.js';
import { validateAssets, mergePaymentRisks } from '../core/validator.js';
import { exportManifest, generateOutputPath } from '../core/exporter.js';
import { checkPaddleStatus } from '../integrations/paddle.js';
import { checkStripeStatus } from '../integrations/stripe.js';
import { buildDoctorReport } from '../commands/doctor.js';

export async function startMcpServer() {
  const server = new McpServer({
    name: 'devassets',
    version: '0.1.0',
  });

  server.tool(
    'devassets_list_projects',
    'List all registered projects and their health status',
    {},
    async () => {
      const projects = listProjects();
      const enriched = projects.map(p => {
        const assets = getAssets(p.id);
        const result = validateAssets(assets, p.id);
        return { id: p.id, name: p.name, path: p.path, type: p.type, status: result.status, assetCount: assets.length };
      });
      return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] };
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
      if (!project) return { content: [{ type: 'text', text: JSON.stringify({ error: `Project not found: ${projectId}` }) }] };

      const assets = getAssets(projectId, environment);
      let result = validateAssets(assets, projectId, environment);

      const platforms = getPaymentPlatforms(projectId);
      const paymentStatuses = [];
      for (const p of platforms) {
        if (p.name === 'paddle') {
          paymentStatuses.push(await checkPaddleStatus(projectId, process.env.PADDLE_API_KEY));
        } else if (p.name === 'stripe') {
          paymentStatuses.push(await checkStripeStatus(projectId, process.env.STRIPE_SECRET_KEY));
        }
      }
      if (paymentStatuses.length > 0) result = mergePaymentRisks(result, paymentStatuses);

      addAuditLog({ projectId, action: 'check', user: getCurrentUser(), timestamp: result.timestamp, details: { environment, via: 'mcp' }, result: 'success' });

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
      if (!project) return { content: [{ type: 'text', text: JSON.stringify({ error: `Project not found: ${projectId}` }) }] };

      const { replaceAssets, upsertPaymentPlatform } = await import('../db/queries.js');
      const scanResult = scanProject(projectId, project.path);
      replaceAssets(projectId, scanResult.assets);
      for (const platform of scanResult.detectedPlatforms) {
        upsertPaymentPlatform({ projectId, name: platform, status: 'unconfigured' });
      }
      addAuditLog({ projectId, action: 'scan', user: getCurrentUser(), timestamp: scanResult.scannedAt, details: { via: 'mcp', assetsFound: scanResult.assets.length }, result: 'success' });

      return { content: [{ type: 'text', text: JSON.stringify({ assetsFound: scanResult.assets.length, envFiles: scanResult.envFilesFound, platforms: scanResult.detectedPlatforms }) }] };
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
      if (!project) return { content: [{ type: 'text', text: JSON.stringify({ error: `Project not found: ${projectId}` }) }] };

      const assets = getAssets(projectId, environment);
      const checkResult = validateAssets(assets, projectId, environment);
      const outputPath = output_path ?? generateOutputPath(projectId, environment, format);

      const result = exportManifest(checkResult, {
        project: projectId, environment, format, encrypt, encryptFor: encrypt_for, outputPath,
      });

      addAuditLog({ projectId, action: 'export', user: getCurrentUser(), timestamp: result.timestamp, details: { environment, format, encrypted: result.encrypted, via: 'mcp' }, result: 'success' });

      return { content: [{ type: 'text', text: JSON.stringify({ signature: result.signature, timestamp: result.timestamp, encrypted: result.encrypted, outputPath: result.outputPath, autoDecision: result.autoDecision, preview: result.content.slice(0, 500) }) }] };
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
      const projects = projectId ? [getProject(projectId)].filter(Boolean) : listProjects();
      const summaries = projects.map(p => {
        if (!p) return null;
        const assets = getAssets(p.id);
        const result = validateAssets(assets, p.id);
        const topRisks = result.risks
          .filter(r => !focus || r.asset.toLowerCase().includes(focus.toLowerCase()))
          .slice(0, 3);
        return { id: p.id, name: p.name, status: result.status, criticalCount: result.risks.filter(r => r.level === 'critical').length, topRisks };
      }).filter(Boolean);

      return { content: [{ type: 'text', text: JSON.stringify(summaries, null, 2) }] };
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
      let logs = getAuditLogs(projectId, since_days);
      if (action) logs = logs.filter(l => l.action === action);
      return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
    }
  );

  server.tool(
    'devassets_rotate',
    'Record intent to rotate an API key and get rotation instructions',
    {
      project: z.string().describe('Project ID'),
      key_name: z.string().describe('Key name to rotate (e.g. PADDLE_API_KEY)'),
    },
    async ({ project: projectId, key_name }) => {
      const project = getProject(projectId);
      if (!project) return { content: [{ type: 'text', text: JSON.stringify({ error: `Project not found: ${projectId}` }) }] };

      addAuditLog({ projectId, action: 'rotate', user: getCurrentUser(), timestamp: new Date().toISOString(), details: { keyName: key_name, status: 'initiated', via: 'mcp' }, result: 'success' });

      const instructions = {
        key: key_name,
        project: projectId,
        status: 'rotation_initiated',
        steps: [
          `Generate a new ${key_name} in the relevant service dashboard`,
          `Update ${key_name} in your .env file and any deployment secrets`,
          'Deploy to pick up the new value',
          `Run: devassets scan ${projectId}  (to record the change)`,
        ],
        auditRecorded: true,
      };

      return { content: [{ type: 'text', text: JSON.stringify(instructions, null, 2) }] };
    }
  );

  server.tool(
    'devassets_add_project',
    'Register a new project with DevAssets',
    {
      id: z.string().describe('Project slug ID (e.g. legita, sparkie)'),
      name: z.string().describe('Human-readable project name'),
      path: z.string().describe('Absolute path to the project directory'),
      type: z.enum(['saas', 'mobile', 'desktop', 'library', 'other']).optional().describe('Project type'),
    },
    async ({ id, name, path: projectPath, type = 'other' }) => {
      upsertProject({ id, name, path: projectPath, type });
      return { content: [{ type: 'text', text: JSON.stringify({ registered: true, id, name, path: projectPath, type, next: `devassets_scan with project=${id}` }) }] };
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
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'No projects registered.' }) }] };
      }
      const report = buildDoctorReport(projects);
      if (asJson) {
        return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
      }
      const summary = {
        generatedAt: report.generatedAt,
        summary: report.summary,
        topRisks: report.topRisks.slice(0, 5),
        recentActivity: report.recentActivity.slice(0, 5),
        projects: report.projects.map(p => ({ id: p.id, name: p.name, status: p.status, riskCount: p.riskCount })),
      };
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
