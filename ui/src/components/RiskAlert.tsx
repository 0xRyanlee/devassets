import { AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskItem } from '../types';

const styles: Record<string, { box: string; icon: typeof Info }> = {
  critical: { box: 'border-red-500/30 bg-red-500/5 text-red-300', icon: ShieldAlert },
  high: { box: 'border-orange-500/30 bg-orange-500/5 text-orange-300', icon: AlertTriangle },
  medium: { box: 'border-amber-500/30 bg-amber-500/5 text-amber-300', icon: AlertTriangle },
  low: { box: 'border-sky-500/30 bg-sky-500/5 text-sky-300', icon: Info },
};

export function RiskAlert({ risk }: { risk: RiskItem }) {
  const s = styles[risk.level] ?? { box: 'border-border bg-muted/30 text-muted-foreground', icon: Info };
  const Icon = s.icon;
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3', s.box)}>
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{risk.level}</span>
          <span className="font-mono text-xs opacity-90">{risk.asset}</span>
        </div>
        <p className="text-sm mt-0.5">{risk.message}</p>
        {risk.suggestion && <p className="text-xs opacity-60 mt-1 font-mono">{risk.suggestion}</p>}
      </div>
    </div>
  );
}
