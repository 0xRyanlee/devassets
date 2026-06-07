export type AssetStatus = 'configured' | 'missing' | 'error' | 'warning';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ProjectType = 'saas' | 'mobile' | 'desktop' | 'library' | 'other';
export type Environment = 'development' | 'staging' | 'production';
export type PaymentPlatformName = 'paddle' | 'stripe' | 'apple_iap' | 'google_play';

export interface Asset {
  id?: number;
  projectId: string;
  name: string;
  location: string;
  status: AssetStatus;
  lastSeen: string;
  environment?: Environment;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  type: ProjectType;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookStatus {
  registered: boolean;
  verified: boolean;
  lastDelivery?: string | null;
  failures7d?: number;
  url?: string;
}

export interface PaymentPlatform {
  id?: number;
  projectId: string;
  name: PaymentPlatformName;
  status: 'connected' | 'disconnected' | 'error' | 'unconfigured';
  lastVerified?: string;
  metadata?: Record<string, unknown>;
}

export interface RiskItem {
  level: RiskLevel;
  asset: string;
  message: string;
  suggestion?: string;
}

export interface AssetStatusDetail {
  name: string;
  status: AssetStatus;
  location: string;
  risk?: RiskLevel;
  message?: string;
}

export interface PaymentStatus {
  platform: PaymentPlatformName;
  status: 'healthy' | 'warning' | 'critical' | 'unconfigured';
  webhook?: WebhookStatus;
  apiKeyAgeDays?: number;
  risks: RiskItem[];
}

export interface CheckResult {
  project: string;
  environment?: string;
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  assets: {
    total: number;
    configured: number;
    missing: number;
    errors: number;
  };
  categories: {
    environmentVariables: AssetStatusDetail[];
    paymentPlatforms: PaymentStatus[];
  };
  risks: RiskItem[];
  suggestions: string[];
}

export interface AuditLog {
  id?: number;
  projectId: string;
  action: string;
  user: string;
  timestamp: string;
  details?: Record<string, unknown>;
  result: 'success' | 'failure';
}

export interface Permission {
  role: string;
  actions: string[];
  projects?: string[];
}
