/**
 * app/guards/page.tsx - Guards listing page.
 *
 * Displays all guards with:
 * - Active/offline status indicator
 * - Last seen timestamp
 * - Role filter (guard, supervisor, admin)
 * - Guard cards with contact info and post location
 *
 * Data fetched via SWR with automatic refresh.
 */

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { User, ApiResponse, UserRole } from '@/lib/types';
import GuardCard from '@/components/GuardCard';

const roleOptions: (UserRole | 'all')[] = ['all', 'guard', 'supervisor', 'admin'];

export default function GuardsPage() {
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Build query params
  const params = new URLSearchParams();
  if (roleFilter !== 'all') params.set('role', roleFilter);
  const queryString = params.toString() ? `?${params.toString()}` : '';

  // Fetch guards (refreshes every 60 seconds)
  const { data, error, isLoading } = useSWR<ApiResponse<User>>(
    `/api/guards${queryString}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const guards = data?.data || [];

  // Count active guards (seen in last 2 hours)
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const activeCount = guards.filter(
    (g) => g.last_seen && new Date(g.last_seen).getTime() > twoHoursAgo
  ).length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Guards</h1>
        <p className="text-gray-500 text-sm">
          {guards.length} total • {activeCount} active
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Role</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            {roleOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All Roles' : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Guards grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading guards...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          Failed to load guards. Is the backend running?
        </div>
      ) : guards.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No guards registered yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guards.map((guard) => (
            <GuardCard key={guard.id} guard={guard} />
          ))}
        </div>
      )}
    </div>
  );
}

