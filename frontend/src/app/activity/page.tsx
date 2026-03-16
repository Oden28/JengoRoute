/**
 * app/activity/page.tsx — Real-time chronological activity feed.
 *
 * Responsive layout:
 *   Desktop (md+): 7-column table for rapid scanning.
 *   Mobile  (<md): Compact stacked cards for each activity item.
 *
 * Auto-refreshes every 8 seconds via SWR.
 * Supabase real-time subscription for instant event streaming.
 */

'use client';

import { useEffect, useState } from 'react';
import { useActivity } from '@/hooks/useApi';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/layout/PageHeader';
import { EventBadge, VerificationBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingState';
import { smartTime, fullDateTime, truncate, formatCoords, mapsLink } from '@/lib/formatters';
import type { ActivityItem } from '@/lib/types';

export default function ActivityPage() {
  const { activities: fetchedActivities, isLoading } = useActivity(150);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Sync SWR data
  useEffect(() => {
    if (fetchedActivities.length > 0) {
      setActivities(fetchedActivities);
    }
  }, [fetchedActivities]);

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('activity-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          const e = payload.new as any;
          const item: ActivityItem = {
            id: e.id,
            type: 'event',
            event_type: e.event_type,
            guard_name: 'New activity',
            description: e.description || '',
            verification_status: e.verification_status,
            latitude: e.latitude,
            longitude: e.longitude,
            media_urls: e.media_urls || [],
            created_at: e.created_at,
          };
          setActivities((prev) => [item, ...prev].slice(0, 300));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={`Chronological operational feed · ${activities.length} events`}
        action={
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live
          </div>
        }
      />

      {/* ── Content ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <LoadingRows count={10} />
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <EmptyState
            icon="📋"
            title="No activity yet"
            description="Guard events will stream here in real-time as they check in, patrol, and report."
          />
        </div>
      ) : (
        <>
          {/* ── Table (always visible, scrolls horizontally on small screens) */}
          <div className="hidden sm:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[80px_100px_100px_1fr_130px_100px_60px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider min-w-[700px]">
                <span>Time</span>
                <span>Type</span>
                <span>Status</span>
                <span>Details</span>
                <span>Location</span>
                <span>Guard</span>
                <span>Media</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-[calc(100vh-220px)] overflow-y-auto min-w-[700px]">
                {activities.map((item) => (
                  <ActivityRowDesktop key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Mobile Cards (phone-only, < 640px) ─────────────────────── */}
          <div className="sm:hidden space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto">
            {activities.map((item) => (
              <ActivityCardMobile key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Desktop Row ─────────────────────────────────────────────────────────── */

function ActivityRowDesktop({ item }: { item: ActivityItem }) {
  const coords = formatCoords(item.latitude, item.longitude);
  const link = mapsLink(item.latitude, item.longitude);

  return (
    <div className="grid grid-cols-[80px_100px_100px_1fr_130px_100px_60px] gap-3 px-4 py-2.5 items-center hover:bg-slate-50/50 transition-colors">
      <span className="text-[11px] text-slate-500 tabular-nums" title={fullDateTime(item.created_at)}>
        {smartTime(item.created_at)}
      </span>
      <EventBadge type={item.event_type} />
      <VerificationBadge status={item.verification_status} />
      <p className="text-xs text-slate-600 truncate">{truncate(item.description, 80) || '—'}</p>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate">{coords}</a>
      ) : (
        <span className="text-[11px] text-slate-300">{coords}</span>
      )}
      <span className="text-xs text-slate-700 font-medium truncate">{item.guard_name}</span>
      <span className="text-[11px] text-slate-400 tabular-nums">
        {item.media_urls?.length > 0 ? `📎 ${item.media_urls.length}` : '—'}
      </span>
    </div>
  );
}

/* ── Mobile Card ─────────────────────────────────────────────────────────── */

function ActivityCardMobile({ item }: { item: ActivityItem }) {
  const coords = formatCoords(item.latitude, item.longitude);
  const link = mapsLink(item.latitude, item.longitude);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-3">
      {/* Top: badges + time */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <EventBadge type={item.event_type} />
          <VerificationBadge status={item.verification_status} />
        </div>
        <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0" title={fullDateTime(item.created_at)}>
          {smartTime(item.created_at)}
        </span>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-xs text-slate-600 mb-1.5">{truncate(item.description, 100)}</p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="font-medium text-slate-700">🛡️ {item.guard_name}</span>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            📍 {coords}
          </a>
        ) : coords !== 'No location' ? (
          <span>📍 {coords}</span>
        ) : null}
        {item.media_urls?.length > 0 && (
          <span>📎 {item.media_urls.length}</span>
        )}
      </div>
    </div>
  );
}
