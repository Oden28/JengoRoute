/**
 * components/Map.tsx - Leaflet map component for guard visualization.
 *
 * Displays:
 * - Guard locations (from events)
 * - Incident points (red markers)
 * - Patrol routes (if sector data available)
 * - Color-coded verification status (green=verified, red=unverified, yellow=pending)
 *
 * Uses react-leaflet with OpenStreetMap tiles (free, no API key needed).
 * Dynamically imported in pages to avoid SSR issues with Leaflet.
 */

'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { Event, VerificationStatus } from '@/lib/types';

// Fix Leaflet default marker icon issue in Next.js / webpack
// (icons don't load properly without this)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Marker colors based on verification status
const statusColors: Record<VerificationStatus, string> = {
  verified: '#22c55e',    // Green
  unverified: '#ef4444',  // Red
  pending: '#eab308',     // Yellow
};

// Marker colors based on event type
const eventTypeColors: Record<string, string> = {
  checkin: '#22c55e',
  patrol: '#3b82f6',
  incident: '#ef4444',
  checkout: '#6b7280',
};

interface MapProps {
  events: Event[];
  center?: [number, number];
  zoom?: number;
}

export default function Map({
  events,
  center = [-1.2921, 36.8219], // Default: Nairobi
  zoom = 13,
}: MapProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Leaflet requires DOM; ensure client-side only
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="bg-gray-200 rounded-lg flex items-center justify-center h-full min-h-[400px]">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  // Filter events that have coordinates
  const mappableEvents = events.filter((e) => e.latitude && e.longitude);

  return (
    <div className="rounded-lg overflow-hidden shadow h-full min-h-[400px]">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full min-h-[400px]"
        scrollWheelZoom={true}
      >
        {/* OpenStreetMap tiles (free, no API key) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Event markers */}
        {mappableEvents.map((event) => {
          const color = event.event_type === 'incident'
            ? eventTypeColors.incident
            : statusColors[event.verification_status] || statusColors.pending;

          const guardName = event.users?.name || 'Unknown';

          return (
            <CircleMarker
              key={event.id}
              center={[event.latitude!, event.longitude!]}
              radius={event.event_type === 'incident' ? 10 : 7}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">{guardName}</p>
                  <p className="capitalize">{event.event_type}</p>
                  {event.description && <p className="text-gray-600">{event.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Status: {event.verification_status}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

