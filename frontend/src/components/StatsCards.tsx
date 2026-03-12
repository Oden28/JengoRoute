/**
 * components/StatsCards.tsx - Dashboard summary statistics cards.
 *
 * Displays key metrics:
 * - Events today
 * - Unverified events
 * - Open incidents
 * - Active guards
 */

import { DashboardStats } from '@/lib/types';

interface StatsCardsProps {
  stats: DashboardStats;
}

const cards = [
  { key: 'events_today' as const, label: 'Events Today', icon: '📋', color: 'border-blue-500' },
  { key: 'unverified_today' as const, label: 'Unverified', icon: '⚠️', color: 'border-yellow-500' },
  { key: 'open_incidents' as const, label: 'Open Incidents', icon: '🚨', color: 'border-red-500' },
  { key: 'active_guards' as const, label: 'Active Guards', icon: '👮', color: 'border-green-500' },
];

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`bg-white rounded-lg shadow p-4 border-l-4 ${card.color}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{stats[card.key]}</p>
            </div>
            <span className="text-2xl">{card.icon}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

