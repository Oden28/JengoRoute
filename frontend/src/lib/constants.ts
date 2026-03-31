/**
 * lib/constants.ts — Design system constants for JengoRoute.
 *
 * Single source of truth for every label, color, and icon used in the UI.
 * All operational semantics live here so the rest of the codebase stays
 * free of magic strings and ad-hoc color decisions.
 */

import {
  EventType,
  VerificationStatus,
  IncidentSeverity,
  IncidentStatus,
} from './types';

// ─── Event Type ─────────────────────────────────────────────────────────────

export const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; icon: string; color: string; bg: string; dot: string }
> = {
  checkin: {
    label: 'Check-in',
    icon: '📍',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  patrol: {
    label: 'Patrol',
    icon: '🚶',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
  },
  incident: {
    label: 'Incident',
    icon: '🚨',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    dot: 'bg-red-500',
  },
  checkout: {
    label: 'Check-out',
    icon: '👋',
    color: 'text-slate-600',
    bg: 'bg-slate-50 border-slate-200',
    dot: 'bg-slate-400',
  },
};

// ─── Verification Status ────────────────────────────────────────────────────

export const VERIFICATION_CONFIG: Record<
  VerificationStatus,
  { label: string; icon: string; color: string; bg: string; ring: string }
> = {
  verified: {
    label: 'Verified',
    icon: '✓',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    ring: 'ring-emerald-500',
  },
  unverified: {
    label: 'Unverified',
    icon: '✗',
    color: 'text-red-700',
    bg: 'bg-red-50 text-red-700 border border-red-200',
    ring: 'ring-red-500',
  },
  pending: {
    label: 'Pending',
    icon: '…',
    color: 'text-amber-700',
    bg: 'bg-amber-50 text-amber-700 border border-amber-200',
    ring: 'ring-amber-500',
  },
};

// ─── Incident Severity ──────────────────────────────────────────────────────

export const SEVERITY_CONFIG: Record<
  IncidentSeverity,
  { label: string; color: string; bg: string; dot: string }
> = {
  low: {
    label: 'Low',
    color: 'text-sky-700',
    bg: 'bg-sky-50 text-sky-700 border border-sky-200',
    dot: 'bg-sky-500',
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-700',
    bg: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
  },
  high: {
    label: 'High',
    color: 'text-orange-700',
    bg: 'bg-orange-50 text-orange-700 border border-orange-200',
    dot: 'bg-orange-500',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bg: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-600',
  },
};

// ─── Incident Status ────────────────────────────────────────────────────────

export const INCIDENT_STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; color: string; bg: string }
> = {
  open: {
    label: 'Open',
    color: 'text-red-700',
    bg: 'bg-red-50 text-red-700 border border-red-200',
  },
  acknowledged: {
    label: 'Acknowledged',
    color: 'text-amber-700',
    bg: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-700',
    bg: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  closed: {
    label: 'Closed',
    color: 'text-slate-600',
    bg: 'bg-slate-50 text-slate-600 border border-slate-200',
  },
};

// ─── Map Colors (hex for Leaflet) ───────────────────────────────────────────

export const MAP_COLORS = {
  verified: '#10b981',
  unverified: '#ef4444',
  pending: '#f59e0b',
  checkin: '#10b981',
  patrol: '#3b82f6',
  incident: '#ef4444',
  checkout: '#64748b',
} as const;

// ─── Refresh Intervals (ms) ────────────────────────────────────────────────

export const REFRESH = {
  stats: 20_000,      // Dashboard stats: 20s
  events: 10_000,     // Events feed: 10s
  incidents: 30_000,  // Incidents: 30s
  guards: 30_000,     // Guards: 30s
  activity: 8_000,    // Activity feed: 8s
} as const;

// ─── Default Map Center (Cape Town CBD) ─────────────────────────────────────

export const DEFAULT_MAP_CENTER: [number, number] = [-33.9249, 18.4241];
export const DEFAULT_MAP_ZOOM = 13;

