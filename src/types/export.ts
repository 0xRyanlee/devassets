export type ManifestFormat = 'manifest' | 'checklist' | 'reference-only';

export interface ExportOptions {
  project: string;
  environment: string;
  format: ManifestFormat;
  encrypt?: boolean;
  encryptFor?: string;
  outputPath?: string;
}

export interface ExportAutoDecision {
  encryptionRecommended: boolean;
  reason?: string;
  riskLevel?: string;
}

export interface ExportResult {
  content: string;
  format: ManifestFormat;
  signature: string;
  timestamp: string;
  encrypted: boolean;
  outputPath?: string;
  autoDecision: ExportAutoDecision;
}

export interface VerifyResult {
  valid: boolean;
  project: string;
  timestamp: string;
  signatureMatch: boolean;
  currentVsManifest?: {
    added: string[];
    removed: string[];
    changed: string[];
  };
  errors: string[];
}
