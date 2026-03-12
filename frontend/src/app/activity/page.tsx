/**
 * app/activity/page.tsx - Real-time activity feed page.
 *
 * Full-page activity stream showing all security events in real-time.
 * Combines events with Supabase real-time subscriptions.
 *
 * Shows:
 * - Event type with color-coded badge
 * - Guard name
 * - Description
 * - Verification status
 * - Location and media indicators
 * - Timestamps
 */

'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { ActivityItem } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';

// Event type styling
const eventStyles: Record<string, { bg: string; icon: string }> = {
  checkin: { bg: 'bg-green-100 text-green-800', icon: '📍' },
  patrol: { bg: 'bg-blue-100 text-blue-800', icon: '🚶' },
  incident: { bg: 'bg-red-100 text-red-800', icon: '🚨' },
  checkout: { bg: 'bg-gray-100 text-gray-800', icon: '👋' },
};

const verificationStyles: Record<string, { bg: string; label: string }> = {
  verified: { bg: 'text-green-600', label: '✅ Verified' },
  unverified: { bg: 'text-red-600', label: '⚠️ Unverified' },
  pending: { bg: 'text-yellow-600', label: '⏳ Pending' },
};

export default function ActivityPage() {
  // Fetch activity feed (refreshes every 15 seconds)
  const { data } = useSWR<{ data: ActivityItem[]; count: number }>(
    '/api/activity?limit=100',
    fetcher,
    { refreshInterval: 15000 }
  );

  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Initialize with fetched data
  useEffect(() => {
    if (data?.data) {
      setActivities(data.data);
    }
  }, [data]);

  // Real-time subscription for new events
  useEffect(() => {
    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          const newEvent = payload.new as any;
          const activity: ActivityItem = {
            id: newEvent.id,
            type: 'event',
            event_type: newEvent.event_type,
            guard_name: 'New Guard Activity', // Will be populated on next SWR refresh
            description: newEvent.description || '',
            verification_status: newEvent.verification_status,
            latitude: newEvent.latitude,
            longitude: newEvent.longitude,
            media_urls: newEvent.media_urls || [],
            created_at: newEvent.created_at,
          };
          setActivities((prev) => [activity, ...prev].slice(0, 200));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Activity Feed</h1>
        <p className="text-gray-500 text-sm">
          Real-time stream of all security events • {activities.length} events
        </p>
      </div>

      {/* Activity timeline */}
      <div className="bg-white rounded-lg shadow">
        {activities.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No activity yet. Guard events will stream here in real-time.
          </div>
        ) : (
          <div className="divide-y">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const style = eventStyles[activity.event_type] || eventStyles.checkin;
  const vStyle = verificationStyles[activity.verification_status] || verificationStyles.pending;
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });
  const fullTime = format(new Date(activity.created_at), 'MMM d, yyyy HH:mm:ss');

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors flex gap-4">
      {/* Icon */}
      <div className="flex-shrink-0 text-2xl mt-1">{style.icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg}`}>
            {activity.event_type}
          </span>
          <span className={`text-xs font-medium ${vStyle.bg}`}>
            {vStyle.label}
          </span>
        </div>

        <p className="text-sm font-medium">{activity.guard_name}</p>
        {activity.description && (
          <p className="text-sm text-gray-600 truncate">{activity.description}</p>
        )}

        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
          <span title={fullTime}>🕐 {timeAgo}</span>
          {activity.latitude && activity.longitude && (
            <a
              href={`https://maps.google.com/?q=${activity.latitude},${activity.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500"
            >
              📍 {activity.latitude.toFixed(4)}, {activity.longitude.toFixed(4)}
            </a>
          )}
          {activity.media_urls.length > 0 && (
            <span>📎 {activity.media_urls.length} file(s)</span>
          )}
        </div>
      </div>
    </div>
  );
}

