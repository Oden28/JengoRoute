/**
 * components/map/EventMap.tsx — Leaflet operational map.
 *
 * Renders guard locations, incidents, and patrol markers on an
 * OpenStreetMap base layer (free, no API key). Markers are
 * color-coded by verification status and event type.
 *
 * Includes a legend so operators immediately understand the colors.
 *
 * Must be dynamically imported (next/dynamic, ssr: false) because
 * Leaflet requires the DOM.
 */

'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Event } from '@/lib/types';
import { MAP_COLORS, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/constants';
import { EVENT_TYPE_CONFIG, VERIFICATION_CONFIG } from '@/lib/constants';
import { smartTime, guardName } from '@/lib/formatters';

// Fix Leaflet marker icons in webpack / Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface EventMapProps {
  events: Event[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export default function EventMap({
  events,
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  height = '100%',
}: EventMapProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) {
    return (
      <div
        className="bg-slate-100 rounded-lg flex items-center justify-center"
        style={{ height, minHeight: 350 }}
      >
        <p className="text-sm text-slate-400">Loading map…</p>
      </div>
    );
  }

  const mappable = events.filter((e) => e.latitude != null && e.longitude != null);

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ height, minHeight: 350 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mappable.map((event) => {
          const isIncident = event.event_type === 'incident';
          const color = isIncident
            ? MAP_COLORS.incident
            : (MAP_COLORS[event.verification_status as keyof typeof MAP_COLORS] ?? MAP_COLORS.pending);

          return (
            <CircleMarker
              key={event.id}
              center={[event.latitude!, event.longitude!]}
              radius={isIncident ? 9 : 6}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.75,
                weight: isIncident ? 2.5 : 1.5,
              }}
            >
              <Popup>
                <div className="text-xs leading-relaxed min-w-[140px]">
                  <p className="font-bold text-slate-800 text-sm mb-0.5">
                    {guardName(event.users)}
                  </p>
                  <p className="capitalize text-slate-600">{event.event_type}</p>
                  {event.description && (
                    <p className="text-slate-500 mt-0.5">{event.description}</p>
                  )}
                  <hr className="my-1.5 border-slate-200" />
                  <p className="text-slate-400">
                    {VERIFICATION_CONFIG[event.verification_status]?.icon}{' '}
                    {VERIFICATION_CONFIG[event.verification_status]?.label}
                  </p>
                  <p className="text-slate-400">{smartTime(event.created_at)}</p>
                  {event.sector && (
                    <p className="text-slate-400">Sector: {event.sector}</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg border border-slate-200 px-3 py-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Legend
        </p>
        <div className="space-y-1">
          {[
            { color: MAP_COLORS.verified, label: 'Verified' },
            { color: MAP_COLORS.unverified, label: 'Unverified' },
            { color: MAP_COLORS.pending, label: 'Pending' },
            { color: MAP_COLORS.incident, label: 'Incident' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

