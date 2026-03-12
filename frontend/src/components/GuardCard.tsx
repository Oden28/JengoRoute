/**
 * components/GuardCard.tsx - Card component for displaying a guard's info.
 *
 * Shows:
 * - Guard name and role
 * - Phone number
 * - Last seen timestamp
 * - Active/offline status indicator
 * - Expected post location
 */

import { User } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface GuardCardProps {
  guard: User;
}

export default function GuardCard({ guard }: GuardCardProps) {
  // Consider "active" if seen in last 2 hours
  const isActive = guard.last_seen
    ? new Date(guard.last_seen).getTime() > Date.now() - 2 * 60 * 60 * 1000
    : false;

  const lastSeen = guard.last_seen
    ? formatDistanceToNow(new Date(guard.last_seen), { addSuffix: true })
    : 'Never';

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      {/* Header: Name + Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Online/offline indicator */}
          <span
            className={`w-3 h-3 rounded-full ${
              isActive ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
          <h3 className="font-semibold text-sm">{guard.name}</h3>
        </div>
        <span className="text-xs text-gray-500 capitalize px-2 py-0.5 bg-gray-100 rounded">
          {guard.role}
        </span>
      </div>

      {/* Contact info */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>📱 {guard.phone}</p>
        {guard.email && <p>📧 {guard.email}</p>}
        <p>🕐 Last seen: {lastSeen}</p>
      </div>

      {/* Expected location */}
      {guard.expected_latitude && guard.expected_longitude && (
        <p className="text-xs text-gray-400 mt-2">
          📍 Post:{' '}
          <a
            href={`https://maps.google.com/?q=${guard.expected_latitude},${guard.expected_longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-500"
          >
            {guard.expected_latitude.toFixed(4)}, {guard.expected_longitude.toFixed(4)}
          </a>
        </p>
      )}
    </div>
  );
}

