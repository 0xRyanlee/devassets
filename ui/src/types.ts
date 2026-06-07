export type ProjectStatus = 'healthy' | 'warning' | 'critical';
export type AssetStatus = 'configured' | 'missing' | 'error' | 'warning';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  type: string;
  status: ProjectStatus;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDetail {
  id: number;
  projectId: string;
  name: string;
  location: string;
  status: AssetStatus;
  environment?: string;
  lastSeen: string;
}

export interface RiskItem {
  level: RiskLevel;
  asset: string;
  message: string;
  suggestion?: string;
}

export interface PaymentPlatform {
  id: number;
  projectId: string;
  name: string;
  status: string;
  lastVerified?: string;
}

export interface CheckResult {
  project: string;
  environment?: string;
  timestamp: string;
  status: ProjectStatus;
  assets: { total: number; configured: number; missing: number; errors: number };
  risks: RiskItem[];
  suggestions: string[];
}

export interface ProjectDetail extends ProjectSummary {
  checkResult: CheckResult;
  platforms: PaymentPlatform[];
}

export interface AuditEntry {
  id: number;
  projectId: string;
  action: string;
  user: string;
  timestamp: string;
  details?: Record<string, unknown>;
  result: 'success' | 'failure';
}
