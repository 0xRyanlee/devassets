import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, ShieldAlert, Boxes } from 'lucide-react';
import { fetchProjects } from '../api';
import { ProjectCard } from '../components/ProjectCard';
import { CountUp } from '../components/bits/CountUp';
import { Card } from '../components/ui/card';
import { cn } from '@/lib/utils';
import type { ProjectSummary } from '../types';

const stats = [
  { key: 'total', label: 'Projects', icon: Boxes, color: 'text-foreground', ring: 'bg-primary/15 text-primary' },
  { key: 'healthy', label: 'Healthy', icon: CheckCircle2, color: 'text-green-400', ring: 'bg-green-500/15 text-green-400' },
  { key: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-amber-400', ring: 'bg-amber-500/15 text-amber-400' },
  { key: 'critical', label: 'Critical', icon: ShieldAlert, color: 'text-red-400', ring: 'bg-red-500/15 text-red-400' },
] as const;

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects().then(setProjects).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-muted-foreground text-sm">Loading projects…</div>;
  if (error) return <div className="text-red-400 text-sm">Error: {error}</div>;

  const counts = {
    total: projects.length,
    healthy: projects.filter(p => p.status === 'healthy').length,
    warning: projects.filter(p => p.status === 'warning').length,
    critical: projects.filter(p => p.status === 'critical').length,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Asset Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Credential health across all registered projects.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', s.ring)}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <CountUp to={counts[s.key]} className={cn('mt-2 block text-3xl font-bold tabular-nums', s.color)} />
              </Card>
            </motion.div>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <Card className="py-16 text-center text-muted-foreground">
          <p>No projects registered yet.</p>
          <p className="text-xs mt-2 font-mono">devassets add-project &lt;name&gt; --path=&lt;path&gt;</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
        </div>
      )}
    </div>
  );
}
