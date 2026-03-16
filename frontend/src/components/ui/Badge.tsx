/**
 * components/ui/Badge.tsx — Unified badge system for JengoRoute.
 *
 * Every operational label in the dashboard uses this component.
 * Provides consistent size, shape, and color for:
 *   - Event types (check-in, patrol, incident, check-out)
 *   - Verification status (verified, unverified, pending)
 *   - Incident severity (low, medium, high, critical)
 *   - Incident lifecycle status (open → closed)
 *
 * Usage:
 *   <EventBadge type="incident" />
 *   <VerificationBadge status="verified" />
 *   <SeverityBadge severity="critical" />
 *   <IncidentStatusBadge status="open" />
 */

import {
  EVENT_TYPE_CONFIG,
  VERIFICATION_CONFIG,
  SEVERITY_CONFIG,
  INCIDENT_STATUS_CONFIG,
} from '@/lib/constants';
import type {
  EventType,
  VerificationStatus,
  IncidentSeverity,
  IncidentStatus,
} from '@/lib/types';

/* ── Base Badge Shell ──────────────────────────────────────────────────────── */

function BaseBadge({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide leading-tight whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

/* ── Event Type Badge ──────────────────────────────────────────────────────── */

export function EventBadge({ type }: { type: EventType }) {
  const cfg = EVENT_TYPE_CONFIG[type] ?? EVENT_TYPE_CONFIG.checkin;
  return (
    <BaseBadge className={`border ${cfg.bg} ${cfg.color}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </BaseBadge>
  );
}

/* ── Verification Status Badge ─────────────────────────────────────────────── */

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const cfg = VERIFICATION_CONFIG[status] ?? VERIFICATION_CONFIG.pending;
  return (
    <BaseBadge className={cfg.bg}>
      <span className="font-bold">{cfg.icon}</span>
      {cfg.label}
    </BaseBadge>
  );
}

/* ── Incident Severity Badge ───────────────────────────────────────────────── */

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
  return (
    <BaseBadge className={cfg.bg}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </BaseBadge>
  );
}

/* ── Incident Status Badge ─────────────────────────────────────────────────── */

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const cfg = INCIDENT_STATUS_CONFIG[status] ?? INCIDENT_STATUS_CONFIG.open;
  return <BaseBadge className={cfg.bg}>{cfg.label}</BaseBadge>;
}

