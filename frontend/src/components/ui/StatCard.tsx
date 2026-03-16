/**
 * components/ui/StatCard.tsx — Dashboard metric card.
 *
 * A compact card that displays a single metric with label and optional
 * sub-metric. Used in the dashboard stats row for at-a-glance numbers.
 *
 * Usage:
 *   <StatCard label="Events Today" value={42} icon="📋" accent="blue" />
 *   <StatCard label="Open Incidents" value={3} icon="🚨" accent="red" sub="1 critical" />
 */

const accentMap: Record<string, string> = {
  blue: 'border-l-blue-500 bg-blue-50/30',
  green: 'border-l-emerald-500 bg-emerald-50/30',
  red: 'border-l-red-500 bg-red-50/30',
  amber: 'border-l-amber-500 bg-amber-50/30',
  slate: 'border-l-slate-400 bg-slate-50/30',
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: string;
  accent?: keyof typeof accentMap;
  sub?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  accent = 'blue',
  sub,
}: StatCardProps) {
  return (
    <div
      className={`rounded-lg border border-l-4 p-4 ${accentMap[accent] ?? accentMap.blue}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {value}
          </p>
          {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {icon && <span className="text-2xl opacity-80">{icon}</span>}
      </div>
    </div>
  );
}

