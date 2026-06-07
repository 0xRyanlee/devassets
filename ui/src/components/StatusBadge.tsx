interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const colors: Record<string, string> = {
  healthy: 'bg-green-900 text-green-300 border border-green-700',
  warning: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  critical: 'bg-red-900 text-red-300 border border-red-700',
  configured: 'bg-green-900 text-green-300 border border-green-700',
  missing: 'bg-red-900 text-red-300 border border-red-700',
  error: 'bg-red-900 text-red-300 border border-red-700',
  unconfigured: 'bg-gray-800 text-gray-400 border border-gray-700',
  connected: 'bg-green-900 text-green-300 border border-green-700',
  disconnected: 'bg-red-900 text-red-300 border border-red-700',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cls = colors[status] ?? 'bg-gray-800 text-gray-400 border border-gray-700';
  const sz = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs';
  return <span className={`${cls} ${sz} rounded font-mono`}>{status}</span>;
}

export function StatusDot({ status }: { status: string }) {
  const dotColors: Record<string, string> = {
    healthy: 'bg-green-400',
    warning: 'bg-yellow-400',
    critical: 'bg-red-400',
    configured: 'bg-green-400',
    missing: 'bg-red-400',
    error: 'bg-red-400',
  };
  const color = dotColors[status] ?? 'bg-gray-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}
