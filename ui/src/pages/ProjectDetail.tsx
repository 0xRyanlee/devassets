import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, KeyRound, AlertTriangle, Fingerprint, CheckCircle2, XCircle } from 'lucide-react';
import { fetchProject, fetchProjectAssets } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { RiskAlert } from '../components/RiskAlert';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { cn } from '@/lib/utils';
import type { ProjectDetail as ProjectDetailType, AssetDetail } from '../types';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const [assets, setAssets] = useState<AssetDetail[]>([]);
  const [env, setEnv] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchProject(id), fetchProjectAssets(id)])
      .then(([p, a]) => { setProject(p); setAssets(a); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !env) return;
    fetchProjectAssets(id, env || undefined).then(setAssets);
  }, [id, env]);

  if (loading) return <div className="text-muted-foreground text-sm">Loading…</div>;
  if (!project) return <div className="text-red-400 text-sm">Project not found</div>;

  const { checkResult } = project;
  const identities = project.identities ?? [];
  const envOptions = ['', 'development', 'staging', 'production'];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="h-4 w-4" /> Dashboard
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">{project.path}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: checkResult.assets.total, color: 'text-foreground' },
          { label: 'Configured', value: checkResult.assets.configured, color: 'text-green-400' },
          { label: 'Missing', value: checkResult.assets.missing, color: 'text-red-400' },
          { label: 'Errors', value: checkResult.assets.errors, color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets"><KeyRound className="h-3.5 w-3.5 mr-1.5" />Assets</TabsTrigger>
          <TabsTrigger value="identities"><Fingerprint className="h-3.5 w-3.5 mr-1.5" />Identities {identities.length > 0 && `(${identities.length})`}</TabsTrigger>
          <TabsTrigger value="risks"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Risks {checkResult.risks.length > 0 && `(${checkResult.risks.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <div className="flex justify-end mb-2">
            <select
              value={env}
              onChange={e => setEnv(e.target.value)}
              className="bg-secondary border border-border text-sm rounded-md px-2 py-1 text-foreground"
            >
              {envOptions.map(o => <option key={o} value={o}>{o || 'All environments'}</option>)}
            </select>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.location}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.environment ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={a.status} size="sm" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {assets.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No assets. Run: devassets scan {id}</p>}
          </Card>
        </TabsContent>

        <TabsContent value="identities">
          {identities.length === 0 ? (
            <Card className="py-10 text-center text-muted-foreground text-sm">
              No provider credentials resolved. Run: <span className="font-mono">devassets identity {id}</span>
            </Card>
          ) : (
            <div className="space-y-2">
              {identities.map(idn => (
                <Card key={idn.keyName} className={cn(idn.mismatch && 'border-red-500/40', !idn.valid && !idn.mismatch && 'border-amber-500/40')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {idn.valid ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-amber-400" />}
                        <span className="font-mono text-sm">{idn.keyName}</span>
                      </div>
                      <Badge variant="muted">{idn.provider}</Badge>
                    </div>
                    {idn.valid ? (
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground pl-6">
                        {idn.account && <div>account: <span className="text-foreground">{idn.account}</span></div>}
                        {idn.workspace && <div>workspace: <span className="text-foreground">{idn.workspace}</span></div>}
                        {idn.projects && idn.projects.length > 0 && <div>projects: <span className="text-foreground">{idn.projects.join(', ')}</span></div>}
                        {idn.mismatch && (
                          <div className="text-red-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> MISMATCH — expected account={idn.expectedAccount ?? '—'} workspace={idn.expectedWorkspace ?? '—'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 pl-6 text-xs text-amber-400">{idn.error ?? 'invalid'}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="risks">
          {checkResult.risks.length === 0 ? (
            <Card className="py-10 text-center text-muted-foreground text-sm">No risks detected.</Card>
          ) : (
            <div className="space-y-2">
              {checkResult.risks.map((r, i) => <RiskAlert key={i} risk={r} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
