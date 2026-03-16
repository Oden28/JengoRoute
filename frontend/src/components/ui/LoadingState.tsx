/**
 * components/ui/LoadingState.tsx — Loading indicators.
 *
 * Provides skeleton rows and a spinner for when data is being fetched.
 * Keeps the UI from jumping when data loads in.
 */

export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          <div className="h-3 bg-slate-200 rounded flex-1 max-w-[180px]" />
          <div className="h-3 bg-slate-100 rounded flex-1 max-w-[120px]" />
          <div className="h-3 bg-slate-100 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="space-y-6">
      {/* Stat cards skeleton — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-l-4 border-l-slate-200 p-4 h-[88px] bg-slate-50" />
        ))}
      </div>
      {/* Content skeleton — stacked mobile, side-by-side desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="animate-pulse rounded-lg bg-slate-100 h-[300px] lg:h-[400px]" />
        <div className="animate-pulse rounded-lg bg-slate-100 h-[300px] lg:h-[400px]" />
      </div>
    </div>
  );
}

