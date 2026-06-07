export interface ProviderIdentity {
  provider: string;
  keyName: string;
  valid: boolean;
  account?: string;
  workspace?: string;
  projects?: string[];
  error?: string;
  expectedAccount?: string;
  expectedWorkspace?: string;
  mismatch?: boolean;
  checkedAt: string;
}

export type ResolvedIdentity = Omit<ProviderIdentity, 'keyName' | 'checkedAt' | 'expectedAccount' | 'expectedWorkspace' | 'mismatch'>;
