/**
 * components/AlertBanner.tsx - Alert banner for critical notifications.
 *
 * Displays at the top of the page when there are:
 * - Open incidents
 * - Unverified events requiring attention
 *
 * Dismissible by the user; auto-refreshes data.
 */

'use client';

import { useState } from 'react';

interface AlertBannerProps {
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  count?: number;
  dismissible?: boolean;
}

const typeStyles = {
  error: 'bg-red-100 border-red-400 text-red-800',
  warning: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  info: 'bg-blue-100 border-blue-400 text-blue-800',
  success: 'bg-green-100 border-green-400 text-green-800',
};

const typeIcons = {
  error: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
};

export default function AlertBanner({
  type,
  message,
  count,
  dismissible = true,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={`border-l-4 p-4 mb-4 rounded flex items-center justify-between ${typeStyles[type]}`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{typeIcons[type]}</span>
        <span className="font-medium">{message}</span>
        {count !== undefined && count > 0 && (
          <span className="bg-white/50 px-2 py-0.5 rounded-full text-sm font-bold">
            {count}
          </span>
        )}
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="text-lg hover:opacity-70"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      )}
    </div>
  );
}

