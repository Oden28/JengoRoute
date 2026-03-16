/**
 * components/ui/EmptyState.tsx — Placeholder for empty data sets.
 *
 * Shown when a table, list, or section has zero items.
 * Provides a clear message so operators know the system is working,
 * there's just nothing to show yet.
 *
 * Usage:
 *   <EmptyState icon="📋" title="No events yet" description="Guard activity will appear here." />
 */

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl mb-3 opacity-60">{icon}</span>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>
      )}
    </div>
  );
}

