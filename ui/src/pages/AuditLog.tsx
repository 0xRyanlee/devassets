import { useEffect, useState } from 'react';
import { fetchAllAudit } from '../api';
import type { AuditEntry } from '../types';

const actionColors: Record<string, string> = {
  scan: 'text-blue-400',
  check: 'text-purple-400',
  export: 'text-green-400',
  verify: 'text-teal-400',
  rotate: 'text-orange-400',
  audit: 'text-gray-400',
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

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Audit Log</h1>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm rounded px-2 py-1 text-gray-300"
        >
          <option value="">All actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center py-8 text-gray-500 text-sm">No audit entries found.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {filtered.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-start gap-4">
                <span className={`text-xs font-mono font-bold w-16 shrink-0 ${actionColors[log.action] ?? 'text-gray-400'}`}>
                  {log.action}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white">{log.projectId}</span>
                    <span className={`text-xs ${log.result === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {log.result}
                    </span>
                    <span className="text-xs text-gray-500">{log.user}</span>
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-xs text-gray-600 font-mono mt-1 truncate">
                      {Object.entries(log.details).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
