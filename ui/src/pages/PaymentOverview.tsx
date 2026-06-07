import { useEffect, useState } from 'react';
import { fetchProjects, fetchProject } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import type { ProjectDetail } from '../types';

export default function PaymentOverview() {
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects().then(async summaries => {
      const details = await Promise.all(summaries.map(p => fetchProject(p.id)));
      setProjects(details.filter(p => p.platforms.length > 0));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-6">Payment Platforms</h1>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No payment platforms detected.</p>
          <p className="text-xs mt-2 font-mono">Run: devassets scan &lt;project&gt;</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <div key={project.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-3">{project.name}</h3>
              <div className="space-y-2">
                {project.platforms.map(platform => (
                  <div key={platform.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <span className="text-sm font-mono">{platform.name}</span>
                      {platform.lastVerified && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Last verified: {new Date(platform.lastVerified).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={platform.status} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
