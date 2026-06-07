import type { RiskItem } from '../types';

const colors: Record<string, string> = {
  critical: 'border-red-700 bg-red-950 text-red-300',
  high: 'border-orange-700 bg-orange-950 text-orange-300',
  medium: 'border-yellow-700 bg-yellow-950 text-yellow-300',
  low: 'border-blue-700 bg-blue-950 text-blue-300',
};

export function RiskAlert({ risk }: { risk: RiskItem }) {
  const cls = colors[risk.level] ?? 'border-gray-700 bg-gray-900 text-gray-300';
  return (
    <div className={`border rounded p-3 ${cls}`}>
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold uppercase mt-0.5">[{risk.level}]</span>
        <div>
          <p className="text-sm">{risk.message}</p>
          {risk.suggestion && (
            <p className="text-xs opacity-70 mt-1 font-mono">{risk.suggestion}</p>
          )}
        </div>
      </div>
    </div>
  );
}
