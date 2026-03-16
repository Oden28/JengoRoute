/**
 * app/dashboard/page.tsx — Main operational dashboard.
 *
 * The primary view for supervisors. Designed for situational awareness:
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  Alert banners (incidents / unverified)                     │
 *  ├────────┬────────┬────────┬────────┬────────────────────────┤
 *  │ Events │ Checkins│Incidents│ Guards │                        │
 *  ├────────┴────────┴────────┴────────┤                        │
 *  │  Recent Events feed               │  Map with markers      │
 *  │  (scrollable, realtime)           │  + legend              │
 *  └───────────────────────────────────┴────────────────────────┘
 *
 * Data auto-refreshes via SWR. Map is dynamically imported (no SSR).
 */

'use client';

import dynamic from 'next/dynamic';
import { useStats, useEvents } from '@/hooks/useApi';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/ui/StatCard';
import AlertBanner from '@/components/ui/AlertBanner';
import EmptyState from '@/components/ui/EmptyState';
import { EventBadge, VerificationBadge } from '@/components/ui/Badge';
import { timeAgo, guardName, truncate, formatCoords, mapsLink } from '@/lib/formatters';
import { LoadingPage } from '@/components/ui/LoadingState';
import type { Event } from '@/lib/types';

const EventMap = dynamic(() => import('@/components/map/EventMap'), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-100 rounded-lg flex items-center justify-center h-full min-h-[350px]">
      <p className="text-sm text-slate-400">Loading map…</p>
    </div>
  ),
});

export default function DashboardPage() {
  const { stats, isLoading: statsLoading } = useStats();
  const { events, isLoading: eventsLoading } = useEvents({ limit: 60 });

  if (statsLoading && eventsLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time security operations overview"
      />

      {/* ── Alert Banners ──────────────────────────────────────────────── */}
      {stats.open_incidents > 0 && (
        <AlertBanner
          type="critical"
          message="Open incidents requiring immediate attention"
          count={stats.open_incidents}
          action={{ label: 'View incidents →', href: '/incidents' }}
        />
      )}
      {stats.unverified_today > 0 && (
        <AlertBanner
          type="warning"
          message="Unverified events detected today"
          count={stats.unverified_today}
        />
      )}

      {/* ── Stats Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Events Today" value={stats.events_today} icon="📋" accent="blue" />
        <StatCard
          label="Unverified"
          value={stats.unverified_today}
          icon="⚠️"
          accent={stats.unverified_today > 0 ? 'amber' : 'slate'}
        />
        <StatCard
          label="Open Incidents"
          value={stats.open_incidents}
          icon="🚨"
          accent={stats.open_incidents > 0 ? 'red' : 'slate'}
        />
        <StatCard label="Active Guards" value={stats.active_guards} icon="🛡️" accent="green" />
      </div>

      {/* ── Main Content: Feed + Map ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Recent Events (3/5 width) */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Recent Events</h2>
              <p className="text-[11px] text-slate-400">{events.length} events</p>
            </div>
            <a
              href="/activity"
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
            >
              View all →
            </a>
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-50">
            {events.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No events yet"
                description="Guard check-ins, patrols, and incidents will appear here."
              />
            ) : (
              events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))
            )}
          </div>
        </div>

        {/* Right: Map (2/5 width) */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">
              Guard Locations
            </h2>
            <p className="text-[11px] text-slate-400">
              {events.filter((e) => e.latitude).length} with location
            </p>
          </div>
          <div className="h-[480px]">
            <EventMap events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Event Row Sub-Component ──────────────────────────────────────────────── */

function EventRow({ event }: { event: Event }) {
  const name = guardName(event.users);
  const coords = formatCoords(event.latitude, event.longitude);
  const link = mapsLink(event.latitude, event.longitude);

  return (
    <div className="px-4 py-3 hover:bg-slate-50/50 transition-colors flex items-start gap-3 group">
      {/* Left: badges stacked */}
      <div className="flex flex-col gap-1 pt-0.5 flex-shrink-0">
        <EventBadge type={event.event_type} />
        <VerificationBadge status={event.verification_status} />
      </div>

      {/* Center: info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
        <p className="text-xs text-slate-500 truncate">
          {truncate(event.description)}
        </p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 transition-colors"
            >
              📍 {coords}
            </a>
          ) : (
            <span className="text-slate-300">📍 {coords}</span>
          )}
          {event.media_urls?.length > 0 && (
            <span>📎 {event.media_urls.length}</span>
          )}
          {event.sector && <span>Sector {event.sector}</span>}
        </div>
      </div>

      {/* Right: time */}
      <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0 pt-0.5">
        {timeAgo(event.created_at)}
      </span>
    </div>
  );
}
