/**
 * app/guards/page.tsx — Guards roster and status page.
 *
 * Responsive layout:
 *   Desktop (md+): Table with 8-column grid.
 *   Mobile  (<md): Stacked cards with status dot, key info, and metrics.
 *
 * Active/idle/offline determined by last_seen timestamp.
 * Role filter at the top.
 */

'use client';

import { useState } from 'react';
import { useGuards, useEvents } from '@/hooks/useApi';
import PageHeader from '@/components/layout/PageHeader';
import StatusDot, { guardStatus } from '@/components/ui/StatusDot';
import EmptyState from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingState';
import { timeAgo, formatCoords, mapsLink } from '@/lib/formatters';
import type { User, UserRole } from '@/lib/types';

const roleOptions: (UserRole | '')[] = ['', 'guard', 'supervisor', 'admin'];

export default function GuardsPage() {
  const [roleFilter, setRoleFilter] = useState('');

  const { guards, isLoading, error } = useGuards({
    role: roleFilter || undefined,
  });

  // Get events to compute per-guard event counts
  const { events } = useEvents({ limit: 200 });

  // Count today's events per guard
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEvents = events.filter(
    (e) => new Date(e.created_at) >= todayStart,
  );
  const eventCounts: Record<string, number> = {};
  todayEvents.forEach((e) => {
    eventCounts[e.user_id] = (eventCounts[e.user_id] || 0) + 1;
  });

  // Last event per guard
  const lastEvent: Record<string, string> = {};
  events.forEach((e) => {
    if (!lastEvent[e.user_id]) {
      lastEvent[e.user_id] = e.event_type;
    }
  });

  const activeCount = guards.filter(
    (g) => guardStatus(g.last_seen) === 'active',
  ).length;

  return (
    <div>
      <PageHeader
        title="Guards"
        subtitle={`${guards.length} total · ${activeCount} active`}
      />

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white text-slate-700 capitalize focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        >
          {roleOptions.map((opt) => (
            <option key={opt} value={opt} className="capitalize">
              {opt === '' ? 'All roles' : opt}
            </option>
          ))}
        </select>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <LoadingRows count={6} />
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-red-500">
          Failed to load guards. Is the backend running?
        </div>
      ) : guards.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <EmptyState
            icon="🛡️"
            title="No guards registered"
            description="Guards will appear here once added to the system."
          />
        </div>
      ) : (
        <>
          {/* ── Table (always visible, scrolls horizontally on small screens) */}
          <div className="hidden sm:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[28px_1fr_80px_120px_120px_100px_100px_80px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider min-w-[750px]">
                <span></span>
                <span>Name</span>
                <span>Role</span>
                <span>Phone</span>
                <span>Post Location</span>
                <span>Last Event</span>
                <span>Last Seen</span>
                <span className="text-right">Today</span>
              </div>
              <div className="divide-y divide-slate-50 min-w-[750px]">
                {guards.map((guard) => (
                  <GuardRowDesktop
                    key={guard.id}
                    guard={guard}
                    todayCount={eventCounts[guard.id] || 0}
                    lastEventType={lastEvent[guard.id]}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Mobile Cards (phone-only, < 640px) ─────────────────────── */}
          <div className="sm:hidden space-y-3">
            {guards.map((guard) => (
              <GuardCardMobile
                key={guard.id}
                guard={guard}
                todayCount={eventCounts[guard.id] || 0}
                lastEventType={lastEvent[guard.id]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Desktop Row ─────────────────────────────────────────────────────────── */

function GuardRowDesktop({
  guard,
  todayCount,
  lastEventType,
}: {
  guard: User;
  todayCount: number;
  lastEventType?: string;
}) {
  const status = guardStatus(guard.last_seen);
  const coords = formatCoords(guard.expected_latitude, guard.expected_longitude);
  const link = mapsLink(guard.expected_latitude, guard.expected_longitude);

  return (
    <div className="grid grid-cols-[28px_1fr_80px_120px_120px_100px_100px_80px] gap-3 px-4 py-3 items-center hover:bg-slate-50/50 transition-colors">
      <StatusDot status={status} size="sm" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{guard.name}</p>
        {guard.email && <p className="text-[11px] text-slate-400 truncate">{guard.email}</p>}
      </div>
      <span className="text-[11px] text-slate-500 capitalize">{guard.role}</span>
      <span className="text-[11px] text-slate-600 tabular-nums">{guard.phone}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate">{coords}</a>
      ) : (
        <span className="text-[11px] text-slate-300">{coords}</span>
      )}
      <span className="text-[11px] text-slate-500 capitalize">{lastEventType || '—'}</span>
      <span className="text-[11px] text-slate-400 tabular-nums">{timeAgo(guard.last_seen)}</span>
      <span className="text-xs font-semibold text-slate-700 tabular-nums text-right">{todayCount}</span>
    </div>
  );
}

/* ── Mobile Card ─────────────────────────────────────────────────────────── */

function GuardCardMobile({
  guard,
  todayCount,
  lastEventType,
}: {
  guard: User;
  todayCount: number;
  lastEventType?: string;
}) {
  const status = guardStatus(guard.last_seen);
  const coords = formatCoords(guard.expected_latitude, guard.expected_longitude);
  const link = mapsLink(guard.expected_latitude, guard.expected_longitude);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
      {/* Top: name + status dot */}
      <div className="flex items-center gap-2.5 mb-2">
        <StatusDot status={status} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{guard.name}</p>
          <p className="text-[11px] text-slate-400 capitalize">{guard.role}</p>
        </div>
        {/* Today count badge */}
        <div className="text-center flex-shrink-0">
          <p className="text-lg font-bold text-slate-700 tabular-nums leading-none">{todayCount}</p>
          <p className="text-[10px] text-slate-400">today</p>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div>
          <span className="text-slate-400">Phone</span>
          <p className="text-slate-600 tabular-nums">{guard.phone}</p>
        </div>
        <div>
          <span className="text-slate-400">Last event</span>
          <p className="text-slate-600 capitalize">{lastEventType || '—'}</p>
        </div>
        <div>
          <span className="text-slate-400">Location</span>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline truncate">{coords}</a>
          ) : (
            <p className="text-slate-300">{coords}</p>
          )}
        </div>
        <div>
          <span className="text-slate-400">Last seen</span>
          <p className="text-slate-600 tabular-nums">{timeAgo(guard.last_seen)}</p>
        </div>
      </div>
    </div>
  );
}
