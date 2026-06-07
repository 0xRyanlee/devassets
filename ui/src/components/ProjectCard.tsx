import { Link } from 'react-router-dom';
import { StatusBadge, StatusDot } from './StatusBadge';
import type { ProjectSummary } from '../types';

interface ProjectCardProps {
  project: ProjectSummary;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link to={`/projects/${project.id}`} className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-white">{project.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{project.type}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <p className="text-xs text-gray-600 truncate mb-3">{project.path}</p>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>{project.assetCount} assets</span>
        <StatusDot status={project.status} />
        <span>{project.status}</span>
      </div>
    </Link>
  );
}
