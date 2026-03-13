/**
 * lib/types.ts - TypeScript type definitions for JengoRoute.
 *
 * Mirrors the backend Pydantic models for type safety
 * across the frontend codebase.
 */

// --- Enums ---

export type EventType = 'checkin' | 'patrol' | 'incident' | 'checkout';
export type VerificationStatus = 'verified' | 'unverified' | 'pending';
export type UserRole = 'guard' | 'supervisor' | 'admin';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
export type MessageType = 'text' | 'location' | 'image' | 'audio' | 'document' | 'unknown';

// --- Data Models ---

export interface Company {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  company_id: string;
  expected_latitude: number | null;
  expected_longitude: number | null;
  email: string | null;
  notify_whatsapp: boolean;
  notify_email: boolean;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Event {
  id: string;
  user_id: string;
  company_id: string;
  event_type: EventType;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  media_urls: string[];
  sector: string | null;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  location_verified: boolean;
  time_verified: boolean;
  photo_verified: boolean;
  created_at: string;
  updated_at: string | null;
  // Joined user data
  users?: {
    name: string;
    phone: string;
    role: UserRole;
  };
}

export interface Incident {
  id: string;
  event_id: string;
  user_id: string;
  company_id: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number | null;
  longitude: number | null;
  media_urls: string[];
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  // Joined data
  users?: { name: string; phone: string };
  events?: Event;
}

export interface Message {
  id: string;
  whatsapp_message_id: string;
  phone: string;
  direction: 'incoming' | 'outgoing';
  message_type: MessageType;
  body: string | null;
  latitude: number | null;
  longitude: number | null;
  media_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  user_id: string | null;
  processed: boolean;
  created_at: string;
}

// --- Activity Feed Item ---
export interface ActivityItem {
  id: string;
  type: 'event';
  event_type: EventType;
  guard_name: string;
  description: string;
  verification_status: VerificationStatus;
  latitude: number | null;
  longitude: number | null;
  media_urls: string[];
  created_at: string;
}

// --- Dashboard Stats ---
export interface DashboardStats {
  events_today: number;
  unverified_today: number;
  open_incidents: number;
  active_guards: number;
}

// --- API Response Wrapper ---
export interface ApiResponse<T> {
  data: T[];
  count: number;
}

