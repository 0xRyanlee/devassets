import { useEffect, useState } from 'react';
import { fetchProjects } from '../api';
import { ProjectCard } from '../components/ProjectCard';
import type { ProjectSummary } from '../types';

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-sm">Loading projects...</div>;
  if (error) return <div className="text-red-400 text-sm">Error: {error}</div>;

  const healthy = projects.filter(p => p.status === 'healthy').length;
  const warning = projects.filter(p => p.status === 'warning').length;
  const critical = projects.filter(p => p.status === 'critical').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Projects</h1>
        <div className="flex gap-4 text-sm">
          <span className="text-green-400">{healthy} healthy</span>
          {warning > 0 && <span className="text-yellow-400">{warning} warning</span>}
          {critical > 0 && <span className="text-red-400">{critical} critical</span>}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No projects registered yet.</p>
          <p className="text-xs mt-2 font-mono">Run: devassets add-project &lt;name&gt; --path=&lt;path&gt;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
}
