import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, KeyRound } from 'lucide-react';
import { SpotlightCard } from './bits/SpotlightCard';
import { StatusBadge, StatusDot } from './StatusBadge';
import type { ProjectSummary } from '../types';

const spotlightByStatus: Record<string, string> = {
  healthy: 'rgba(34,197,94,0.12)',
  warning: 'rgba(245,158,11,0.14)',
  critical: 'rgba(239,68,68,0.16)',
};

export function ProjectCard({ project, index = 0 }: { project: ProjectSummary; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link to={`/projects/${project.id}`}>
        <SpotlightCard
          spotlightColor={spotlightByStatus[project.status] ?? 'rgba(59,130,246,0.12)'}
          className="group p-4 transition-colors hover:border-foreground/20"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{project.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{project.type}</p>
            </div>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-xs text-muted-foreground/70 truncate mb-3 font-mono">{project.path}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              {project.assetCount} assets
            </span>
            <span className="flex items-center gap-1.5">
              <StatusDot status={project.status} />
              <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
            </span>
          </div>
        </SpotlightCard>
      </Link>
    </motion.div>
  );
}
