/**
 * app/incidents/page.tsx - Incidents listing page.
 *
 * Displays all incidents with:
 * - Filter by status (open, acknowledged, in_progress, resolved, closed)
 * - Filter by severity (low, medium, high, critical)
 * - Incident cards with photo, location, timestamp
 * - Click to view details
 *
 * Data fetched via SWR with automatic refresh.
 */

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Incident, ApiResponse, IncidentStatus, IncidentSeverity } from '@/lib/types';
import IncidentCard from '@/components/IncidentCard';
import AlertBanner from '@/components/AlertBanner';

const statusOptions: (IncidentStatus | 'all')[] = [
  'all', 'open', 'acknowledged', 'in_progress', 'resolved', 'closed',
];

const severityOptions: (IncidentSeverity | 'all')[] = [
  'all', 'low', 'medium', 'high', 'critical',
];

export default function IncidentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Build query params for filtering
  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (severityFilter !== 'all') params.set('severity', severityFilter);
  const queryString = params.toString() ? `?${params.toString()}` : '';

  // Fetch incidents (refreshes every 30 seconds)
  const { data, error, isLoading } = useSWR<ApiResponse<Incident>>(
    `/api/incidents${queryString}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const incidents = data?.data || [];
  const openCount = incidents.filter((i) => i.status === 'open').length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <p className="text-gray-500 text-sm">Track and manage security incidents</p>
      </div>

      {/* Alert for open incidents */}
      {openCount > 0 && (
        <AlertBanner
          type="error"
          message={`${openCount} open incident(s) need attention`}
          count={openCount}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Status filter */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All Status' : opt.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Severity filter */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Severity</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            {severityOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All Severity' : opt}
              </option>
            ))}
          </select>
        </div>

        {/* Count */}
        <div className="flex items-end">
          <span className="text-sm text-gray-500">
            {incidents.length} incident(s) found
          </span>
        </div>
      </div>

      {/* Incidents grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading incidents...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          Failed to load incidents. Is the backend running?
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No incidents found. All clear! ✅
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      )}
    </div>
  );
}

