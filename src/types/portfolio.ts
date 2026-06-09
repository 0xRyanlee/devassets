export type PortfolioProjectStatus = 'healthy' | 'attention' | 'unknown' | 'archived';
export type PortfolioStage = 'active' | 'planning' | 'maintenance' | 'archived';
export type PortfolioCiStatus = 'success' | 'failure' | 'pending' | 'unavailable';
export type PortfolioGithubSource = 'live' | 'snapshot' | 'mixed' | 'unavailable';

export interface PortfolioGitState {
  isRepo: boolean;
  branch?: string;
  dirtyFiles: number;
  untrackedFiles: number;
  ahead: number;
  behind: number;
  remote?: string;
  repository?: string;
  lastCommit?: {
    hash: string;
    date: string;
    subject: string;
  };
}

export interface PortfolioGithubState {
  available: boolean;
  source?: 'live' | 'snapshot';
  capturedAt?: string;
  visibility?: string;
  defaultBranch?: string;
  pushedAt?: string;
  openIssues: number;
  openPullRequests: number;
  ci: PortfolioCiStatus;
  workflow?: string;
  workflowUrl?: string;
}

export interface PortfolioAssetState {
  status: 'healthy' | 'warning' | 'critical' | 'error';
  assets: number;
  configured: number;
  managed: number;
  missing: number;
  risks: number;
  topRisks: Array<{
    level: string;
    asset: string;
    message: string;
  }>;
  error?: string;
}

export interface PortfolioProject {
  id: string;
  name: string;
  path: string;
  description: string;
  stage: PortfolioStage;
  status: PortfolioProjectStatus;
  stack: string[];
  progress: number;
  recentWork: string;
  nextAction: string;
  evidence: string[];
  git: PortfolioGitState;
  github: PortfolioGithubState;
  assets: PortfolioAssetState;
}

export interface PortfolioReport {
  schemaVersion: 1;
  runId: string;
  generatedAt: string;
  generatedAtLocal: string;
  root: string;
  summary: {
    total: number;
    active: number;
    healthy: number;
    attention: number;
    archived: number;
    gitRepos: number;
    dirtyRepos: number;
    unpushedRepos: number;
    githubRepos: number;
    ciSuccess: number;
    assetWarnings: number;
  };
  verification: {
    devassetsVersion: string;
    scanSucceeded: number;
    scanFailed: number;
    githubSource: PortfolioGithubSource;
    githubCapturedAt?: string;
    notes: string[];
  };
  projects: PortfolioProject[];
}

export interface PortfolioRunArtifacts {
  current: string;
  history: string;
  log: string;
  journal: string;
}
