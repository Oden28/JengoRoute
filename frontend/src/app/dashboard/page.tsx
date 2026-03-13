/**
 * app/dashboard/page.tsx - Main dashboard page.
 *
 * Displays:
 * - Summary statistics cards (events today, unverified, incidents, active guards)
 * - Alert banners for critical issues
 * - Live event feed (left panel)
 * - Map visualization (right panel)
 *
 * Data fetched via SWR for automatic revalidation.
 * Map is dynamically imported to avoid Leaflet SSR issues.
 */

'use client';

import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Event, DashboardStats, ApiResponse } from '@/lib/types';
import StatsCards from '@/components/StatsCards';
import LiveFeed from '@/components/LiveFeed';
import AlertBanner from '@/components/AlertBanner';

// Dynamic import for Map (Leaflet doesn't work with SSR)
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-200 rounded-lg flex items-center justify-center h-full min-h-[400px]">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

export default function DashboardPage() {
  // Fetch dashboard stats (refreshes every 30 seconds)
  const { data: stats } = useSWR<DashboardStats>(
    '/api/stats',
    fetcher,
    { refreshInterval: 30000, fallbackData: { events_today: 0, unverified_today: 0, open_incidents: 0, active_guards: 0 } }
  );

  // Fetch recent events for feed and map (refreshes every 15 seconds)
  const { data: eventsResponse } = useSWR<ApiResponse<Event>>(
    '/api/events?limit=50',
    fetcher,
    { refreshInterval: 15000, fallbackData: { data: [], count: 0 } }
  );

  const events = eventsResponse?.data || [];
  const dashboardStats = stats || { events_today: 0, unverified_today: 0, open_incidents: 0, active_guards: 0 };

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 text-sm">Real-time security operations overview</p>
      </div>

      {/* Alert banners */}
      {dashboardStats.open_incidents > 0 && (
        <AlertBanner
          type="error"
          message="Open incidents requiring attention"
          count={dashboardStats.open_incidents}
        />
      )}
      {dashboardStats.unverified_today > 0 && (
        <AlertBanner
          type="warning"
          message="Unverified events today"
          count={dashboardStats.unverified_today}
        />
      )}

      {/* Stats cards */}
      <StatsCards stats={dashboardStats} />

      {/* Main content: Feed + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Live Feed */}
        <div>
          <LiveFeed initialEvents={events} />
        </div>

        {/* Right: Map */}
        <div className="min-h-[500px]">
          <div className="bg-white rounded-lg shadow p-4 h-full">
            <h2 className="text-lg font-semibold mb-3">Guard Locations & Events</h2>
            <div className="h-[calc(100%-2rem)]">
              <Map events={events} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

