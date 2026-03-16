/**
 * components/layout/PageHeader.tsx — Consistent page title bar.
 *
 * Every page gets a title, subtitle, and optional action area.
 * Keeps the visual hierarchy consistent across the whole dashboard.
 *
 * Usage:
 *   <PageHeader
 *     title="Incidents"
 *     subtitle="Track and manage security incidents"
 *     action={<button>Export</button>}
 *   />
 */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

