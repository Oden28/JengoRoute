/**
 * hooks/useApi.ts — SWR data-fetching hooks for every entity.
 *
 * Centralizes all data fetching in one place so pages stay clean.
 * Each hook handles its own SWR config, refresh intervals, and
 * returns { data, error, isLoading } consistently.
 */

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { REFRESH } from '@/lib/constants';
import type {
  Event,
  Incident,
  User,
  DashboardStats,
  ActivityItem,
  ApiResponse,
} from '@/lib/types';

/* ── Dashboard Stats ───────────────────────────────────────────────────────── */

const defaultStats: DashboardStats = {
  events_today: 0,
  unverified_today: 0,
  open_incidents: 0,
  active_guards: 0,
};

export function useStats() {
  const { data, error, isLoading } = useSWR<DashboardStats>(
    '/api/stats',
    fetcher,
    { refreshInterval: REFRESH.stats, fallbackData: defaultStats },
  );
  return { stats: data ?? defaultStats, error, isLoading };
}

/* ── Events ────────────────────────────────────────────────────────────────── */

export function useEvents(params?: {
  type?: string;
  status?: string;
  limit?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.type) sp.set('event_type', params.type);
  if (params?.status) sp.set('verification_status', params.status);
  sp.set('limit', String(params?.limit ?? 50));
  const qs = sp.toString();

  const { data, error, isLoading } = useSWR<ApiResponse<Event>>(
    `/api/events?${qs}`,
    fetcher,
    { refreshInterval: REFRESH.events, fallbackData: { data: [], count: 0 } },
  );
  return { events: data?.data ?? [], count: data?.count ?? 0, error, isLoading };
}

/* ── Incidents ─────────────────────────────────────────────────────────────── */

export function useIncidents(params?: {
  status?: string;
  severity?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.severity) sp.set('severity', params.severity);
  const qs = sp.toString();

  const { data, error, isLoading } = useSWR<ApiResponse<Incident>>(
    `/api/incidents${qs ? '?' + qs : ''}`,
    fetcher,
    { refreshInterval: REFRESH.incidents, fallbackData: { data: [], count: 0 } },
  );
  return { incidents: data?.data ?? [], count: data?.count ?? 0, error, isLoading };
}

/* ── Guards ─────────────────────────────────────────────────────────────────── */

export function useGuards(params?: { role?: string }) {
  const sp = new URLSearchParams();
  if (params?.role) sp.set('role', params.role);
  const qs = sp.toString();

  const { data, error, isLoading } = useSWR<ApiResponse<User>>(
    `/api/guards${qs ? '?' + qs : ''}`,
    fetcher,
    { refreshInterval: REFRESH.guards, fallbackData: { data: [], count: 0 } },
  );
  return { guards: data?.data ?? [], count: data?.count ?? 0, error, isLoading };
}

/* ── Activity Feed ─────────────────────────────────────────────────────────── */

export function useActivity(limit = 100) {
  const { data, error, isLoading } = useSWR<{ data: ActivityItem[]; count: number }>(
    `/api/activity?limit=${limit}`,
    fetcher,
    { refreshInterval: REFRESH.activity, fallbackData: { data: [], count: 0 } },
  );
  return { activities: data?.data ?? [], count: data?.count ?? 0, error, isLoading };
}

