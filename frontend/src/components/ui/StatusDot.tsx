/**
 * components/ui/StatusDot.tsx — Online / offline / alert indicator.
 *
 * A small colored dot that indicates guard activity status.
 * Pulses when "active" to give a real-time heartbeat feel.
 *
 * Usage:
 *   <StatusDot status="active" />
 *   <StatusDot status="offline" />
 *   <StatusDot status="alert" />
 */

type DotStatus = 'active' | 'offline' | 'alert' | 'idle';

const dotStyles: Record<DotStatus, string> = {
  active: 'bg-emerald-500',
  idle: 'bg-amber-400',
  alert: 'bg-red-500',
  offline: 'bg-slate-300',
};

interface StatusDotProps {
  status: DotStatus;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' };

export default function StatusDot({
  status,
  pulse,
  size = 'md',
  label,
}: StatusDotProps) {
  const shouldPulse = pulse ?? status === 'active';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex">
        {shouldPulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${dotStyles[status]}`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full ${sizeMap[size]} ${dotStyles[status]}`}
        />
      </span>
      {label && (
        <span className="text-xs text-slate-500 capitalize">{label}</span>
      )}
    </span>
  );
}

/**
 * Derive a guard's status from their last_seen timestamp.
 * Active: seen within 2 hours. Idle: 2–8 hours. Offline: >8 hours or never.
 */
export function guardStatus(lastSeen: string | null): DotStatus {
  if (!lastSeen) return 'offline';
  const diff = Date.now() - new Date(lastSeen).getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 2) return 'active';
  if (hours < 8) return 'idle';
  return 'offline';
}

