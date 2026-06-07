import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { fetchAllAudit } from '../api';
import { Card } from '../components/ui/card';
import { cn } from '@/lib/utils';
import type { AuditEntry } from '../types';

const actionColors: Record<string, string> = {
  scan: 'bg-blue-500/15 text-blue-400',
  check: 'bg-purple-500/15 text-purple-400',
  export: 'bg-green-500/15 text-green-400',
  verify: 'bg-teal-500/15 text-teal-400',
  rotate: 'bg-orange-500/15 text-orange-400',
  identity: 'bg-cyan-500/15 text-cyan-400',
  audit: 'bg-muted text-muted-foreground',
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchAllAudit().then(setLogs).finally(() => setLoading(false));
  }, []);

  const filtered = filter ? logs.filter(l => l.action === filter || l.projectId === filter) : logs;
  const actions = [...new Set(logs.map(l => l.action))];

  if (loading) return <div className="text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Every scan, check, export, and rotation.</p>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-secondary border border-border text-sm rounded-md px-2 py-1.5 text-foreground"
        >
          <option value="">All actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">No audit entries found.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide rounded px-2 py-1 w-20 text-center shrink-0', actionColors[log.action] ?? 'bg-muted text-muted-foreground')}>
                  {log.action}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{log.projectId}</span>
                    {log.result === 'success'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span className="text-xs text-muted-foreground">{log.user}</span>
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-xs text-muted-foreground/70 font-mono mt-1 truncate">
                      {Object.entries(log.details).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground/70 shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
