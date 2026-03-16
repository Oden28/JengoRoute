/**
 * components/ui/AlertBanner.tsx — Operational alert banner.
 *
 * Prominent notification bar for critical conditions that require
 * immediate supervisor attention. Appears at the top of a page.
 *
 * Types:
 *   critical — Red, for active incidents
 *   warning  — Amber, for unverified events
 *   info     — Blue, for informational notices
 *   success  — Green, for resolved confirmations
 */

'use client';

import { useState } from 'react';

type AlertType = 'critical' | 'warning' | 'info' | 'success';

const styles: Record<AlertType, { bg: string; border: string; icon: string }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    icon: '🚨',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    icon: '⚠️',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    icon: 'ℹ️',
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    icon: '✅',
  },
};

interface AlertBannerProps {
  type: AlertType;
  message: string;
  count?: number;
  dismissible?: boolean;
  action?: { label: string; href: string };
}

export default function AlertBanner({
  type,
  message,
  count,
  dismissible = true,
  action,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const s = styles[type];

  return (
    <div
      className={`${s.bg} border-l-4 ${s.border} rounded-r-lg px-4 py-3 mb-4 flex items-center justify-between`}
      role="alert"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base flex-shrink-0">{s.icon}</span>
        <span className="text-sm font-medium text-slate-800 truncate">
          {message}
        </span>
        {count != null && count > 0 && (
          <span className="flex-shrink-0 bg-white/60 text-slate-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
        {action && (
          <a
            href={action.href}
            className="flex-shrink-0 text-xs font-semibold underline underline-offset-2 hover:opacity-70"
          >
            {action.label}
          </a>
        )}
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 ml-3 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

