/**
 * app/incidents/page.tsx — Incident management page.
 *
 * Responsive layout:
 *   Desktop (md+): Table with columns for efficient scanning.
 *   Mobile  (<md): Stacked cards, one per incident — every field visible.
 *
 * Filters for status and severity at the top.
 * Alert banner for open incident count.
 */

'use client';

import { useState } from 'react';
import { useIncidents } from '@/hooks/useApi';
import PageHeader from '@/components/layout/PageHeader';
import AlertBanner from '@/components/ui/AlertBanner';
import { SeverityBadge, IncidentStatusBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingState';
import { smartTime, fullDateTime, guardName, truncate, formatCoords, mapsLink } from '@/lib/formatters';
import type { Incident, IncidentStatus, IncidentSeverity } from '@/lib/types';

const statusOptions: (IncidentStatus | '')[] = [
  '', 'open', 'acknowledged', 'in_progress', 'resolved', 'closed',
];
const severityOptions: (IncidentSeverity | '')[] = [
  '', 'low', 'medium', 'high', 'critical',
];

export default function IncidentsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const { incidents, isLoading, error } = useIncidents({
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
  });

  const openCount = incidents.filter(
    (i) => i.status === 'open' || i.status === 'acknowledged',
  ).length;

  return (
    <div>
      <PageHeader
        title="Incidents"
        subtitle="Track and manage security incidents"
      />

      {openCount > 0 && (
        <AlertBanner
          type="critical"
          message={`${openCount} incident${openCount > 1 ? 's' : ''} need attention`}
          count={openCount}
        />
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          formatter={(v) => (v === '' ? 'All status' : v.replace('_', ' '))}
        />
        <Select
          label="Severity"
          value={severityFilter}
          onChange={setSeverityFilter}
          options={severityOptions}
          formatter={(v) => (v === '' ? 'All severity' : v)}
        />
        <span className="text-xs text-slate-400 ml-auto tabular-nums">
          {incidents.length} result{incidents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <LoadingRows count={6} />
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-red-500">
          Failed to load incidents. Is the backend running?
        </div>
      ) : incidents.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <EmptyState
            icon="✅"
            title="No incidents"
            description="All clear. Incidents reported by guards will appear here."
          />
        </div>
      ) : (
        <>
          {/* ── Table (always visible, scrolls horizontally on small screens) */}
          <div className="hidden sm:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[100px_1fr_1.5fr_120px_100px_90px_60px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider min-w-[700px]">
                <span>Time</span>
                <span>Guard</span>
                <span>Description</span>
                <span>Location</span>
                <span>Severity</span>
                <span>Status</span>
                <span>Media</span>
              </div>
              <div className="divide-y divide-slate-50 min-w-[700px]">
                {incidents.map((inc) => (
                  <IncidentRowDesktop key={inc.id} incident={inc} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Mobile Cards (phone-only, < 640px) ─────────────────────── */}
          <div className="sm:hidden space-y-3">
            {incidents.map((inc) => (
              <IncidentCardMobile key={inc.id} incident={inc} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Desktop Row ─────────────────────────────────────────────────────────── */

function IncidentRowDesktop({ incident }: { incident: Incident }) {
  const name = guardName(incident.users);
  const coords = formatCoords(incident.latitude, incident.longitude);
  const link = mapsLink(incident.latitude, incident.longitude);

  return (
    <div className="grid grid-cols-[100px_1fr_1.5fr_120px_100px_90px_60px] gap-3 px-4 py-3 items-center hover:bg-slate-50/50 transition-colors text-sm">
      <span className="text-xs text-slate-500 tabular-nums" title={fullDateTime(incident.created_at)}>
        {smartTime(incident.created_at)}
      </span>
      <span className="font-medium text-slate-800 truncate text-xs">{name}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{incident.title}</p>
        {incident.description && (
          <p className="text-[11px] text-slate-400 truncate">{truncate(incident.description, 80)}</p>
        )}
      </div>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate">{coords}</a>
      ) : (
        <span className="text-[11px] text-slate-300">{coords}</span>
      )}
      <SeverityBadge severity={incident.severity} />
      <IncidentStatusBadge status={incident.status} />
      <span className="text-xs text-slate-400 tabular-nums">
        {incident.media_urls?.length > 0 ? `📎 ${incident.media_urls.length}` : '—'}
      </span>
    </div>
  );
}

/* ── Mobile Card ─────────────────────────────────────────────────────────── */

function IncidentCardMobile({ incident }: { incident: Incident }) {
  const name = guardName(incident.users);
  const coords = formatCoords(incident.latitude, incident.longitude);
  const link = mapsLink(incident.latitude, incident.longitude);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-2.5">
      {/* Top row: title + time */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 leading-tight">
          {incident.title}
        </p>
        <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0" title={fullDateTime(incident.created_at)}>
          {smartTime(incident.created_at)}
        </span>
      </div>

      {/* Description */}
      {incident.description && (
        <p className="text-xs text-slate-500">{truncate(incident.description, 120)}</p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <IncidentStatusBadge status={incident.status} />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>🛡️ {name}</span>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            📍 {coords}
          </a>
        ) : (
          <span className="text-slate-300">📍 {coords}</span>
        )}
        {incident.media_urls?.length > 0 && (
          <span>📎 {incident.media_urls.length} file{incident.media_urls.length > 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}

/* ── Filter Select ───────────────────────────────────────────────────────── */

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  formatter,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: T[];
  formatter: (v: T) => string;
}) {
  return (
    <div>
      <label className="sr-only">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 capitalize"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="capitalize">
            {formatter(opt)}
          </option>
        ))}
      </select>
    </div>
  );
}
