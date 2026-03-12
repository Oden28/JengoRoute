/**
 * components/LiveFeed.tsx - Real-time event feed.
 *
 * Displays a scrollable list of recent security events with:
 * - Event type badge (checkin, patrol, incident)
 * - Guard name
 * - Timestamp
 * - Verification status indicator
 * - Location coordinates
 *
 * Supports Supabase real-time subscriptions for live updates.
 */

'use client';

import { useEffect, useState } from 'react';
import { Event, VerificationStatus, EventType } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

// Badge colors for event types
const eventTypeBadge: Record<EventType, { bg: string; label: string }> = {
  checkin: { bg: 'bg-green-100 text-green-800', label: 'Check-in' },
  patrol: { bg: 'bg-blue-100 text-blue-800', label: 'Patrol' },
  incident: { bg: 'bg-red-100 text-red-800', label: 'Incident' },
  checkout: { bg: 'bg-gray-100 text-gray-800', label: 'Check-out' },
};

// Verification status indicators
const verificationBadge: Record<VerificationStatus, { bg: string; icon: string }> = {
  verified: { bg: 'bg-green-100 text-green-800', icon: '✅' },
  unverified: { bg: 'bg-red-100 text-red-800', icon: '⚠️' },
  pending: { bg: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
};

interface LiveFeedProps {
  initialEvents: Event[];
}

export default function LiveFeed({ initialEvents }: LiveFeedProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);

  // Subscribe to real-time event inserts via Supabase
  useEffect(() => {
    const channel = supabase
      .channel('events-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          // Prepend new event to the top of the feed
          const newEvent = payload.new as Event;
          setEvents((prev) => [newEvent, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold">Live Event Feed</h2>
        <p className="text-sm text-gray-500">{events.length} recent events</p>
      </div>

      <div className="divide-y max-h-[600px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No events yet. Guard activity will appear here.
          </div>
        ) : (
          events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: Event }) {
  const typeBadge = eventTypeBadge[event.event_type] || eventTypeBadge.checkin;
  const vBadge = verificationBadge[event.verification_status] || verificationBadge.pending;
  const guardName = event.users?.name || 'Unknown Guard';
  const timeAgo = formatDistanceToNow(new Date(event.created_at), { addSuffix: true });

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {/* Event type badge */}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadge.bg}`}>
            {typeBadge.label}
          </span>
          {/* Verification badge */}
          <span className={`px-2 py-0.5 rounded text-xs ${vBadge.bg}`}>
            {vBadge.icon}
          </span>
        </div>
        <span className="text-xs text-gray-500">{timeAgo}</span>
      </div>

      <p className="text-sm font-medium">{guardName}</p>
      {event.description && (
        <p className="text-sm text-gray-600 truncate">{event.description}</p>
      )}

      {/* Location coordinates */}
      {event.latitude && event.longitude && (
        <p className="text-xs text-gray-400 mt-1">
          📍 {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
        </p>
      )}

      {/* Media indicator */}
      {event.media_urls && event.media_urls.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          📎 {event.media_urls.length} attachment(s)
        </p>
      )}
    </div>
  );
}

