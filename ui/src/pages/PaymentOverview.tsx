import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard } from 'lucide-react';
import { fetchProjects, fetchProject } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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

  if (loading) return <div className="text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Payment Platforms</h1>
        <p className="text-sm text-muted-foreground mt-1">Webhook and API key status across projects.</p>
      </div>

      {projects.length === 0 ? (
        <Card className="py-16 text-center text-muted-foreground">
          <p>No payment platforms detected.</p>
          <p className="text-xs mt-2 font-mono">devassets scan &lt;project&gt;</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project, i) => (
            <motion.div key={project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{project.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {project.platforms.map(platform => (
                    <div key={platform.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-mono capitalize">{platform.name}</span>
                          {platform.lastVerified && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Last verified: {new Date(platform.lastVerified).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={platform.status} size="sm" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
