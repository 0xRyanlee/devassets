import axios from 'axios';
import type { ProjectSummary, ProjectDetail, AuditEntry, AssetDetail } from './types';

const api = axios.create({ baseURL: '/api' });

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const { data } = await api.get('/projects');
  return data;
}

export async function fetchProject(id: string): Promise<ProjectDetail> {
  const { data } = await api.get(`/projects/${id}`);
  return data;
}

export async function fetchProjectAssets(id: string, env?: string): Promise<AssetDetail[]> {
  const { data } = await api.get(`/projects/${id}/assets`, { params: env ? { env } : {} });
  return data;
}

export async function fetchProjectAudit(id: string, sinceDays = 30): Promise<AuditEntry[]> {
  const { data } = await api.get(`/projects/${id}/audit`, { params: { since: sinceDays } });
  return data;
}

export async function fetchAllAudit(): Promise<AuditEntry[]> {
  const { data } = await api.get('/audit');
  return data;
}
