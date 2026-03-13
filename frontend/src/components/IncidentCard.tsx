/**
 * components/IncidentCard.tsx - Card component for displaying an incident.
 *
 * Shows:
 * - Title and description
 * - Severity badge (color-coded)
 * - Status
 * - Location link
 * - Media thumbnails
 * - Timestamp
 */

import { Incident, IncidentSeverity, IncidentStatus } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

// Severity badge colors
const severityStyles: Record<IncidentSeverity, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

// Status badge colors
const statusStyles: Record<IncidentStatus, string> = {
  open: 'bg-red-100 text-red-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

interface IncidentCardProps {
  incident: Incident;
}

export default function IncidentCard({ incident }: IncidentCardProps) {
  const guardName = incident.users?.name || 'Unknown Guard';
  const timeAgo = formatDistanceToNow(new Date(incident.created_at), { addSuffix: true });

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      {/* Header: Title + Severity */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm">{incident.title}</h3>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityStyles[incident.severity]}`}>
          {incident.severity.toUpperCase()}
        </span>
      </div>

      {/* Description */}
      {incident.description && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{incident.description}</p>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
        <span>👮 {guardName}</span>
        <span>•</span>
        <span className={`px-2 py-0.5 rounded ${statusStyles[incident.status]}`}>
          {incident.status.replace('_', ' ')}
        </span>
        <span>•</span>
        <span>{timeAgo}</span>
      </div>

      {/* Location */}
      {incident.latitude && incident.longitude && (
        <p className="text-xs text-gray-400 mb-2">
          📍{' '}
          <a
            href={`https://maps.google.com/?q=${incident.latitude},${incident.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-500"
          >
            {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
          </a>
        </p>
      )}

      {/* Media thumbnails */}
      {incident.media_urls && incident.media_urls.length > 0 && (
        <div className="flex gap-2 mt-2">
          {incident.media_urls.slice(0, 3).map((url, idx) => (
            <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={`Incident media ${idx + 1}`}
                className="w-16 h-16 object-cover rounded border"
              />
            </a>
          ))}
          {incident.media_urls.length > 3 && (
            <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-500">
              +{incident.media_urls.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

