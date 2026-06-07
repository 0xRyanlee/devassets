import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProject, fetchProjectAssets } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { RiskAlert } from '../components/RiskAlert';
import type { ProjectDetail as ProjectDetailType, AssetDetail } from '../types';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const [assets, setAssets] = useState<AssetDetail[]>([]);
  const [env, setEnv] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchProject(id), fetchProjectAssets(id)])
      .then(([p, a]) => { setProject(p); setAssets(a); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !env) return;
    fetchProjectAssets(id, env || undefined).then(setAssets);
  }, [id, env]);

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;
  if (!project) return <div className="text-red-400 text-sm">Project not found</div>;

  const { checkResult } = project;
  const envOptions = ['', 'development', 'staging', 'production'];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <span className="text-white">{project.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-xs text-gray-500 font-mono mt-1">{project.path}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: checkResult.assets.total },
          { label: 'Configured', value: checkResult.assets.configured, color: 'text-green-400' },
          { label: 'Missing', value: checkResult.assets.missing, color: 'text-red-400' },
          { label: 'Errors', value: checkResult.assets.errors, color: 'text-orange-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded p-3 text-center">
            <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {checkResult.risks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">Risks</h2>
          <div className="space-y-2">
            {checkResult.risks.map((r, i) => <RiskAlert key={i} risk={r} />)}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-400">Assets</h2>
          <select
            value={env}
            onChange={e => setEnv(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-sm rounded px-2 py-1 text-gray-300"
          >
            {envOptions.map(o => <option key={o} value={o}>{o || 'All environments'}</option>)}
          </select>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Location</th>
                <th className="text-left px-4 py-2">Environment</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2 font-mono text-xs text-white">{a.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400">{a.location}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{a.environment ?? '—'}</td>
                  <td className="px-4 py-2"><StatusBadge status={a.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {assets.length === 0 && (
            <p className="text-center py-8 text-gray-500 text-sm">No assets. Run: devassets scan {id}</p>
          )}
        </div>
      </div>
    </div>
  );
}
