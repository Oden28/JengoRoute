-- ============================================
-- JengoRoute Database Schema
-- Run this in Supabase SQL Editor to set up tables.
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- COMPANIES TABLE
-- Security firms using JengoRoute.
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    hq_latitude DOUBLE PRECISION,
    hq_longitude DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- ============================================
-- USERS TABLE
-- Guards and supervisors. Identified by WhatsApp phone number.
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL UNIQUE,                    -- WhatsApp number with country code
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'guard',             -- guard | supervisor | admin
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    expected_latitude DOUBLE PRECISION,            -- Expected post location
    expected_longitude DOUBLE PRECISION,
    email TEXT,
    notify_whatsapp BOOLEAN DEFAULT TRUE,
    notify_email BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);

-- ============================================
-- EVENTS TABLE
-- All security events: check-ins, patrols, incidents.
-- Core of the verification layer.
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,                       -- checkin | patrol | incident | checkout
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    media_urls JSONB DEFAULT '[]'::jsonb,           -- Array of Supabase Storage URLs
    sector TEXT,                                    -- Patrol sector
    verification_status TEXT DEFAULT 'pending',     -- verified | unverified | pending
    verification_notes TEXT,
    location_verified BOOLEAN DEFAULT FALSE,
    time_verified BOOLEAN DEFAULT FALSE,
    photo_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_verification ON events(verification_status);

-- ============================================
-- INCIDENTS TABLE
-- Incidents requiring supervisor attention.
-- Links back to the originating event.
-- ============================================
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium',                -- low | medium | high | critical
    status TEXT DEFAULT 'open',                    -- open | acknowledged | in_progress | resolved | closed
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    media_urls JSONB DEFAULT '[]'::jsonb,
    assigned_to UUID REFERENCES users(id),         -- Supervisor
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incidents_company ON incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

-- ============================================
-- MESSAGES TABLE
-- Raw WhatsApp messages for audit trail.
-- Every incoming/outgoing message is stored before processing.
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_message_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    direction TEXT DEFAULT 'incoming',             -- incoming | outgoing
    message_type TEXT DEFAULT 'text',              -- text | location | image | audio | document
    body TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    media_id TEXT,                                  -- WhatsApp media ID
    media_url TEXT,                                 -- Supabase Storage URL
    media_mime_type TEXT,
    raw_payload JSONB,
    user_id UUID REFERENCES users(id),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_processed ON messages(processed);

-- ============================================
-- ROW LEVEL SECURITY (Optional, for Supabase)
-- Enable RLS and create policies per company.
-- ============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SEED DATA (for testing)
-- ============================================
INSERT INTO companies (id, name, phone, email, hq_latitude, hq_longitude)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'JengoRoute Security Demo',
    '+254700000000',
    'demo@jengoroute.com',
    -1.2921,    -- Nairobi latitude
    36.8219     -- Nairobi longitude
) ON CONFLICT DO NOTHING;

INSERT INTO users (id, phone, name, role, company_id, expected_latitude, expected_longitude)
VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    '+254711111111',
    'John Guard',
    'guard',
    'a0000000-0000-0000-0000-000000000001',
    -1.2921,
    36.8219
),
(
    'b0000000-0000-0000-0000-000000000002',
    '+254722222222',
    'Jane Supervisor',
    'supervisor',
    'a0000000-0000-0000-0000-000000000001',
    NULL,
    NULL
)
ON CONFLICT DO NOTHING;

