import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { scanProject } from './scanner.js';
import { validateAssets } from './validator.js';
import { slugify } from '../utils/slug.js';
import type {
  PortfolioAssetState,
  PortfolioCiStatus,
  PortfolioGithubState,
  PortfolioGithubSource,
  PortfolioGitState,
  PortfolioProject,
  PortfolioReport,
  PortfolioRunArtifacts,
  PortfolioStage,
} from '../types/portfolio.js';

const ARCHIVED_NAMES = new Set(['OLD']);
const DOC_FILES = ['README.md', 'ROADMAP.md', 'TASKS.md', 'PRD.md', 'ARCHITECTURE.md'];
const CATALOG_FILENAME = '.devassets-catalog.json';

type Catalog = Record<string, {
  description: string;
  stage: PortfolioStage;
  nextAction: string;
}>;

/**
 * Optional per-root override file (gitignored, not shipped with the npm package) letting a user
 * hand-annotate description/stage/nextAction per project directory name. Absent file → {}, and
 * every project falls back to the inferred description/stage/nextAction below.
 */
function loadCatalog(root: string): Catalog {
  const file = path.join(root, CATALOG_FILENAME);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Catalog;
  } catch {
    return {};
  }
}

export interface PortfolioOptions {
  root: string;
  output?: string;
  github?: boolean;
  githubSnapshot?: string;
}

interface GithubObservation {
  visibility?: string;
  defaultBranch?: string;
  pushedAt?: string;
  openIssues: number;
  openPullRequests: number;
  ci: PortfolioCiStatus;
  workflow?: string;
  workflowUrl?: string;
}

interface GithubSnapshot {
  capturedAt: string;
  repositories: Record<string, GithubObservation>;
}

export function generatePortfolioReport(options: PortfolioOptions): PortfolioReport {
  const generatedAt = new Date().toISOString();
  const runId = generatedAt.replace(/[:.]/g, '-');
  const githubSnapshot = readGithubSnapshot(options.githubSnapshot);
  const useLiveGithub = !!options.github && githubLiveAvailable();
  const catalog = loadCatalog(options.root);
  const entries = fs.readdirSync(options.root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const projects = entries.map(entry => inspectProject(
    entry.name,
    path.join(options.root, entry.name),
    useLiveGithub,
    catalog,
    githubSnapshot?.repositories,
    githubSnapshot?.capturedAt,
  ));
  const githubSource = summarizeGithubSource(projects.map(project => project.github));

  const report: PortfolioReport = {
    schemaVersion: 1,
    runId,
    generatedAt,
    generatedAtLocal: new Intl.DateTimeFormat('sv-SE', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'Asia/Taipei',
    }).format(new Date(generatedAt)),
    root: options.root,
    summary: {
      total: projects.length,
      active: projects.filter(project => project.stage === 'active').length,
      healthy: projects.filter(project => project.status === 'healthy').length,
      attention: projects.filter(project => project.status === 'attention').length,
      archived: projects.filter(project => project.status === 'archived').length,
      gitRepos: projects.filter(project => project.git.isRepo).length,
      dirtyRepos: projects.filter(project => project.git.dirtyFiles + project.git.untrackedFiles > 0).length,
      unpushedRepos: projects.filter(project => project.git.ahead > 0).length,
      githubRepos: projects.filter(project => project.github.available).length,
      ciSuccess: projects.filter(project => project.github.ci === 'success').length,
      assetWarnings: projects.filter(project => project.assets.status === 'warning' || project.assets.status === 'critical').length,
    },
    verification: {
      devassetsVersion: '0.7.0',
      scanSucceeded: projects.filter(project => project.assets.status !== 'error').length,
      scanFailed: projects.filter(project => project.assets.status === 'error').length,
      githubSource,
      githubCapturedAt: githubSource === 'live'
        ? generatedAt
        : githubSource === 'snapshot' ? githubSnapshot?.capturedAt : undefined,
      notes: [
        'DevAssets reads environment variable names and declaration files; secret values are not stored in this report.',
        'GitHub state is unavailable when a project has no GitHub remote or gh authentication is unavailable.',
        'CI unavailable means no recent workflow signal was found; it does not mean CI passed.',
        githubSource === 'snapshot'
          ? `GitHub API was unavailable; repository state came from the immutable observation captured at ${githubSnapshot?.capturedAt}.`
          : githubSource === 'live'
            ? 'GitHub repository state was queried live during this run.'
            : githubSource === 'mixed'
              ? 'GitHub state combines live queries with the latest immutable fallback observation; each project records its own source and capture time.'
            : 'No GitHub observation source was available for this run.',
      ],
    },
    projects,
  };

  if (options.output) writeAtomic(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function readPortfolioReport(file: string): PortfolioReport {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as PortfolioReport;
}

export function writePortfolioRun(report: PortfolioReport, overviewRoot: string): PortfolioRunArtifacts {
  const [year, month, day] = report.generatedAtLocal.slice(0, 10).split('-');
  const history = path.join(overviewRoot, 'data', 'history', year, month, day, `${report.runId}.json`);
  const current = path.join(overviewRoot, 'data', 'current.json');
  const log = path.join(overviewRoot, 'logs', year, month, day, `${report.runId}.md`);
  const journal = path.join(overviewRoot, 'logs', 'runs.jsonl');

  if (fs.existsSync(history) || fs.existsSync(log)) {
    throw new Error(`Portfolio run already exists: ${report.runId}`);
  }

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const written: string[] = [];

  try {
    fs.mkdirSync(path.dirname(history), { recursive: true });
    fs.writeFileSync(history, serialized, { flag: 'wx' });
    written.push(history);

    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(log, renderRunLog(report, path.relative(overviewRoot, history)), { flag: 'wx' });
    written.push(log);

    fs.mkdirSync(path.dirname(journal), { recursive: true });
    fs.appendFileSync(journal, `${JSON.stringify({
      runId: report.runId,
      generatedAt: report.generatedAt,
      generatedAtLocal: report.generatedAtLocal,
      sourceRoot: report.root,
      snapshot: path.relative(overviewRoot, history),
      log: path.relative(overviewRoot, log),
      summary: report.summary,
      verification: report.verification,
    })}\n`);

    writeAtomic(current, serialized);
  } catch (err) {
    for (const f of written) {
      try { fs.unlinkSync(f); } catch { /* best-effort cleanup */ }
    }
    throw err;
  }

  return { current, history, log, journal };
}

function inspectProject(
  name: string,
  projectPath: string,
  includeGithub: boolean,
  catalog: Catalog,
  githubSnapshot?: GithubSnapshot['repositories'],
  githubCapturedAt?: string,
): PortfolioProject {
  const catalogEntry = catalog[name];
  const git = inspectGit(projectPath);
  const github = git.repository
    ? includeGithub
      ? inspectGithub(git.repository, githubSnapshot?.[git.repository], githubCapturedAt)
      : fromGithubSnapshot(githubSnapshot?.[git.repository], githubCapturedAt)
    : emptyGithub();
  const assets = inspectAssets(name, projectPath);
  const stack = detectStack(projectPath);
  const evidence = DOC_FILES.filter(file => fs.existsSync(path.join(projectPath, file)));
  const description = catalogEntry?.description ?? extractDescription(name, projectPath, stack);
  const stage = catalogEntry?.stage ?? inferStage(name, projectPath, stack, git);
  const status = inferStatus(stage, git, github, assets);

  return {
    id: slugify(name),
    name,
    path: projectPath,
    description,
    stage,
    status,
    stack,
    progress: scoreReadiness(stage, git, github, assets, evidence),
    recentWork: git.lastCommit?.subject ?? (stage === 'planning' ? '文件與架構持續成形' : '尚無可讀取的提交紀錄'),
    nextAction: catalogEntry?.nextAction ?? inferNextAction(stage, git, github, assets),
    evidence,
    git,
    github,
    assets,
  };
}

function inspectGit(projectPath: string): PortfolioGitState {
  if (!fs.existsSync(path.join(projectPath, '.git'))) {
    return { isRepo: false, dirtyFiles: 0, untrackedFiles: 0, ahead: 0, behind: 0 };
  }

  const status = run('git', ['status', '--porcelain'], projectPath);
  const lines = status ? status.split('\n').filter(Boolean) : [];
  const untrackedFiles = lines.filter(line => line.startsWith('??')).length;
  const branch = run('git', ['branch', '--show-current'], projectPath) || 'detached';
  const remote = run('git', ['remote', 'get-url', 'origin'], projectPath) || undefined;
  const repository = remote ? githubRepository(remote) : undefined;
  const counts = run('git', ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], projectPath);
  const [behind = 0, ahead = 0] = counts
    ? counts.split(/\s+/).map(value => Number.parseInt(value, 10) || 0)
    : [0, 0];
  const log = run('git', ['log', '-1', '--date=iso-strict', '--format=%h%x09%ad%x09%s'], projectPath);
  const [hash, date, ...subject] = log?.split('\t') ?? [];

  return {
    isRepo: true,
    branch,
    dirtyFiles: lines.length - untrackedFiles,
    untrackedFiles,
    ahead,
    behind,
    remote,
    repository,
    lastCommit: hash && date ? { hash, date, subject: subject.join('\t') } : undefined,
  };
}

function inspectGithub(
  repository: string,
  fallback?: GithubObservation,
  fallbackCapturedAt?: string,
): PortfolioGithubState {
  try {
    const repo = JSON.parse(execFileSync('gh', [
      'repo', 'view', repository,
      '--json', 'visibility,defaultBranchRef,pushedAt,issues,pullRequests',
    ], {
      encoding: 'utf-8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }));
    const workflow = inspectWorkflow(repository, repo.defaultBranchRef?.name);

    return {
      available: true,
      source: 'live',
      capturedAt: new Date().toISOString(),
      visibility: repo.visibility?.toLowerCase(),
      defaultBranch: repo.defaultBranchRef?.name,
      pushedAt: repo.pushedAt,
      openIssues: Array.isArray(repo.issues) ? repo.issues.length : 0,
      openPullRequests: Array.isArray(repo.pullRequests) ? repo.pullRequests.length : 0,
      ...workflow,
    };
  } catch {
    return fromGithubSnapshot(fallback, fallbackCapturedAt);
  }
}

function inspectWorkflow(
  repository: string,
  defaultBranch?: string,
): Pick<PortfolioGithubState, 'ci' | 'workflow' | 'workflowUrl'> {
  try {
    const output = execFileSync('gh', [
      'run', 'list', '-R', repository, '-L', '1',
      '--json', 'conclusion,status,workflowName,url',
    ], {
      encoding: 'utf-8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const [run] = JSON.parse(output) as Array<{
      conclusion?: string;
      status?: string;
      workflowName?: string;
      url?: string;
    }>;
    if (run) {
      let ci: PortfolioCiStatus = 'pending';
      if (run.conclusion === 'success') ci = 'success';
      else if (run.conclusion) ci = 'failure';
      return { ci, workflow: run.workflowName, workflowUrl: run.url };
    }
  } catch {
    // Fall through to commit statuses for Vercel and other external checks.
  }
  return inspectCommitStatus(repository, defaultBranch);
}

function inspectCommitStatus(
  repository: string,
  defaultBranch?: string,
): Pick<PortfolioGithubState, 'ci' | 'workflow' | 'workflowUrl'> {
  if (!defaultBranch) return { ci: 'unavailable' };
  try {
    const output = execFileSync('gh', [
      'api', `repos/${repository}/commits/${defaultBranch}/status`,
    ], {
      encoding: 'utf-8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const status = JSON.parse(output) as {
      state?: string;
      statuses?: Array<{ context?: string; target_url?: string }>;
    };
    if (!status.statuses?.length) return { ci: 'unavailable' };
    const ci: PortfolioCiStatus = status.state === 'success'
      ? 'success'
      : status.state === 'pending' ? 'pending' : 'failure';
    return {
      ci,
      workflow: status.statuses.map(item => item.context).filter(Boolean).join(', '),
      workflowUrl: status.statuses.find(item => item.target_url)?.target_url,
    };
  } catch {
    return { ci: 'unavailable' };
  }
}

function inspectAssets(name: string, projectPath: string): PortfolioAssetState {
  try {
    const scan = scanProject(slugify(name), projectPath);
    const result = validateAssets(scan.assets, slugify(name));
    return {
      status: result.status,
      assets: result.assets.total,
      configured: result.assets.configured,
      managed: result.assets.managed,
      missing: result.assets.missing,
      risks: result.risks.length,
      topRisks: result.risks.slice(0, 3).map(risk => ({
        level: risk.level,
        asset: risk.asset,
        message: risk.message,
      })),
    };
  } catch (error) {
    return {
      status: 'error',
      assets: 0,
      configured: 0,
      managed: 0,
      missing: 0,
      risks: 0,
      topRisks: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function detectStack(projectPath: string): string[] {
  const stack = new Set<string>();
  const packageFiles = findFiles(projectPath, 'package.json', 2);
  for (const file of packageFiles) {
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
      if (dependencies.next) stack.add('Next.js');
      if (dependencies.react) stack.add('React');
      if (dependencies.vite) stack.add('Vite');
      if (dependencies.express) stack.add('Express');
      if (dependencies['@supabase/supabase-js']) stack.add('Supabase');
      if (dependencies.typescript) stack.add('TypeScript');
    } catch {
      continue;
    }
  }
  if (findFiles(projectPath, 'pyproject.toml', 2).length || findFiles(projectPath, 'requirements.txt', 2).length) stack.add('Python');
  if (findFiles(projectPath, 'Cargo.toml', 3).length) stack.add('Rust');
  if (findFiles(projectPath, 'ProjectSettings', 2, true).length) stack.add('Unity');
  if (findFiles(projectPath, 'go.mod', 3).length) stack.add('Go');
  if (findFiles(projectPath, 'schema.sql', 2).length) stack.add('SQL');
  return [...stack].slice(0, 5);
}

function extractDescription(name: string, projectPath: string, stack: string[]): string {
  const packageFiles = findFiles(projectPath, 'package.json', 1);
  for (const file of packageFiles) {
    try {
      const description = JSON.parse(fs.readFileSync(file, 'utf-8')).description;
      if (typeof description === 'string' && description.trim()) return description.trim();
    } catch {
      continue;
    }
  }

  for (const fileName of ['README.md', 'PRD.md']) {
    const file = path.join(projectPath, fileName);
    if (!fs.existsSync(file)) continue;
    const paragraph = fs.readFileSync(file, 'utf-8')
      .split(/\n\s*\n/)
      .map(block => block.replace(/^#+\s+.*$/gm, '').replace(/[`*_>#|]/g, '').replace(/\s+/g, ' ').trim())
      .find(block => block.length >= 30 && !block.startsWith('http'));
    if (paragraph) return paragraph.slice(0, 180);
  }

  if (ARCHIVED_NAMES.has(name) || name.startsWith('_legacy')) return '歷史資料與舊版實作歸檔。';
  if (stack.length) return `${stack.join('、')} 技術棧專案，尚未提供明確產品簡介。`;
  return '早期研究、文件或未分類工作區。';
}

function inferStage(name: string, projectPath: string, stack: string[], git: PortfolioGitState): PortfolioStage {
  if (ARCHIVED_NAMES.has(name) || name.startsWith('_legacy')) return 'archived';
  if (!stack.length && DOC_FILES.some(file => fs.existsSync(path.join(projectPath, file)))) return 'planning';
  if (!stack.length && !git.isRepo) return 'planning';
  if (git.lastCommit && Date.now() - Date.parse(git.lastCommit.date) > 90 * 86_400_000) return 'maintenance';
  return 'active';
}

function inferStatus(
  stage: PortfolioStage,
  git: PortfolioGitState,
  github: PortfolioGithubState,
  assets: PortfolioAssetState,
): PortfolioProject['status'] {
  if (stage === 'archived') return 'archived';
  if (assets.status === 'error') return 'unknown';
  if (
    assets.status !== 'healthy'
    || !git.isRepo
    || git.dirtyFiles + git.untrackedFiles > 0
    || git.ahead > 0
    || git.behind > 0
    || github.ci === 'failure'
  ) return 'attention';
  return 'healthy';
}

function scoreReadiness(
  stage: PortfolioStage,
  git: PortfolioGitState,
  github: PortfolioGithubState,
  assets: PortfolioAssetState,
  evidence: string[],
): number {
  if (stage === 'archived') return 100;
  let score = stage === 'planning' ? 20 : 35;
  if (git.isRepo) score += 10;
  if (git.isRepo && git.dirtyFiles + git.untrackedFiles === 0) score += 10;
  if (git.ahead === 0 && git.behind === 0) score += 10;
  if (assets.status === 'healthy') score += 15;
  else if (assets.status === 'warning') score += 7;
  if (github.available) score += 5;
  if (github.ci === 'success') score += 10;
  if (evidence.length > 0) score += 5;
  return Math.min(score, 100);
}

export function summarizeGithubSource(states: PortfolioGithubState[]): PortfolioGithubSource {
  const sources = new Set(states.flatMap(state => state.source ? [state.source] : []));
  if (sources.size > 1) return 'mixed';
  if (sources.has('live')) return 'live';
  if (sources.has('snapshot')) return 'snapshot';
  return 'unavailable';
}

function inferNextAction(
  stage: PortfolioStage,
  git: PortfolioGitState,
  github: PortfolioGithubState,
  assets: PortfolioAssetState,
): string {
  if (stage === 'archived') return '維持唯讀歸檔，避免將 credentials、logs 或生成資料公開推送。';
  if (!git.isRepo) return '建立版本控制與遠端備份，先保護目前程式碼和文件。';
  if (git.behind > 0) return `先同步遠端 ${git.behind} 個 commit，再整合本機變更。`;
  if (git.ahead > 0) return `審查並推送 ${git.ahead} 個本機 commit。`;
  if (git.dirtyFiles + git.untrackedFiles > 0) return '整理未提交變更，切分可驗證的 commit 並更新進度文件。';
  if (assets.status === 'warning' || assets.status === 'critical') return `處理 ${assets.missing} 個未配置項目，或在 .devassets.yml 標註受管位置。`;
  if (github.available && github.ci === 'unavailable') return '補上最小 CI：typecheck、test、build，讓遠端狀態可驗證。';
  return '依路線圖推進下一個最小可交付功能，保持測試與文件同步。';
}

function findFiles(root: string, name: string, maxDepth: number, directory = false): string[] {
  const found: string[] = [];
  const walk = (current: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'archive', 'target'].includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.name === name && entry.isDirectory() === directory) found.push(full);
      if (entry.isDirectory()) walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return found;
}

function githubRepository(remote: string): string | undefined {
  const match = remote.match(/github\.com[/:]([^/]+\/[^/]+)$/);
  return match?.[1]?.replace(/\.git$/, '');
}

function emptyGithub(): PortfolioGithubState {
  return { available: false, openIssues: 0, openPullRequests: 0, ci: 'unavailable' };
}

function fromGithubSnapshot(
  observation?: GithubObservation,
  capturedAt?: string,
): PortfolioGithubState {
  if (!observation) return emptyGithub();
  return {
    available: true,
    source: 'snapshot',
    capturedAt,
    ...observation,
  };
}

function readGithubSnapshot(file?: string): GithubSnapshot | undefined {
  if (!file || !fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as GithubSnapshot;
  } catch {
    return undefined;
  }
}

function githubLiveAvailable(): boolean {
  try {
    const remaining = execFileSync('gh', [
      'api', 'rate_limit',
      '--jq', '[.resources.core.remaining,.resources.graphql.remaining] | min',
    ], {
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return (Number.parseInt(remaining, 10) || 0) >= 40;
  } catch {
    return false;
  }
}

function run(command: string, args: string[], cwd: string): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function writeAtomic(file: string, contents: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents);
  fs.renameSync(temporary, file);
}

function renderRunLog(report: PortfolioReport, snapshot: string): string {
  const attention = report.projects
    .filter(project => project.status === 'attention')
    .map(project => `- ${project.name}: ${project.nextAction}`)
    .join('\n') || '- None';

  return `# Astoria Portfolio Run ${report.generatedAtLocal}

- Run ID: \`${report.runId}\`
- Source root: \`${report.root}\`
- Immutable snapshot: \`${snapshot}\`
- Projects: ${report.summary.total}
- Healthy: ${report.summary.healthy}
- Attention: ${report.summary.attention}
- Archived: ${report.summary.archived}
- Dirty repos: ${report.summary.dirtyRepos}
- Unpushed repos: ${report.summary.unpushedRepos}
- GitHub repos: ${report.summary.githubRepos}
- CI success signals: ${report.summary.ciSuccess}
- DevAssets scans: ${report.verification.scanSucceeded} passed, ${report.verification.scanFailed} failed

## Attention At This Run

${attention}

## Integrity Notes

${report.verification.notes.map(note => `- ${note}`).join('\n')}
`;
}
