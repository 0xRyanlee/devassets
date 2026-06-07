import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

const variantMap: Record<string, 'healthy' | 'warning' | 'critical' | 'muted'> = {
  healthy: 'healthy',
  configured: 'healthy',
  connected: 'healthy',
  warning: 'warning',
  critical: 'critical',
  missing: 'critical',
  error: 'critical',
  disconnected: 'critical',
  unconfigured: 'muted',
};

export function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const variant = variantMap[status] ?? 'muted';
  return <Badge variant={variant} className={cn('font-mono', size === 'sm' && 'px-1.5 py-0 text-[10px]')}>{status}</Badge>;
}

export function StatusDot({ status }: { status: string }) {
  const dotColors: Record<string, string> = {
    healthy: 'bg-green-400', warning: 'bg-amber-400', critical: 'bg-red-400',
    configured: 'bg-green-400', missing: 'bg-red-400', error: 'bg-red-400',
  };
  const color = dotColors[status] ?? 'bg-muted-foreground';
  return <span className={cn('inline-block w-2 h-2 rounded-full', color)} />;
}
