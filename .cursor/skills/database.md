---
description: Database rules for GuardOps — Supabase PostgreSQL schema, migrations, seed data, and storage buckets
globs: database/**/*.sql,backend/**/db/**/*.py
alwaysApply: false
---

# GuardOps Database Layer

## 1. Database Provider

- **Supabase** (managed PostgreSQL) is the sole database provider
- Use the `supabase-py` client (`supabase`) in all backend Python code
- Initialize using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side or frontend code
- Media files (incident photos, voice notes, images) are stored in **Supabase Storage buckets**

```python
# backend/app/db/client.py
from supabase import create_client, Client
from app.config import settings

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
```

---

## 2. Complete Schema — `database/schema.sql`

Run this file against your Supabase project to initialise all tables, constraints, and indexes.

```sql
-- ============================================================
-- GuardOps Schema
-- Supabase / PostgreSQL
-- ============================================================

-- --------------------------------------------------------
-- Companies
-- --------------------------------------------------------
CREATE TABLE companies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Users (guards, supervisors, admins)
-- --------------------------------------------------------
CREATE TABLE users (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID    NOT NULL REFERENCES companies(id),
  full_name    TEXT    NOT NULL,
  phone_number TEXT    UNIQUE NOT NULL,
  role         TEXT    NOT NULL CHECK (role IN ('guard', 'supervisor', 'admin')),
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Sites (protected locations)
-- --------------------------------------------------------
CREATE TABLE sites (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID    NOT NULL REFERENCES companies(id),
  name                  TEXT    NOT NULL,
  address               TEXT,
  latitude              NUMERIC,
  longitude             NUMERIC,
  allowed_radius_meters INTEGER DEFAULT 200,
  active                BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Posts (guard stations within a site)
-- --------------------------------------------------------
CREATE TABLE posts (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id               UUID    NOT NULL REFERENCES sites(id),
  name                  TEXT    NOT NULL,
  latitude              NUMERIC,
  longitude             NUMERIC,
  allowed_radius_meters INTEGER DEFAULT 100,
  active                BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Guard Assignments
-- --------------------------------------------------------
CREATE TABLE guard_assignments (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES users(id),
  site_id     UUID    NOT NULL REFERENCES sites(id),
  post_id     UUID    REFERENCES posts(id),
  shift_start TIMESTAMPTZ,
  shift_end   TIMESTAMPTZ,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Raw WhatsApp Messages (immutable — never UPDATE these rows)
-- --------------------------------------------------------
CREATE TABLE messages (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID    REFERENCES companies(id),
  user_id             UUID    REFERENCES users(id),
  direction           TEXT    NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  whatsapp_message_id TEXT,
  message_type        TEXT    NOT NULL CHECK (message_type IN (
                        'text', 'location', 'image', 'audio', 'interactive', 'unknown'
                      )),
  raw_payload_json    JSONB   NOT NULL,
  text_body           TEXT,
  latitude            NUMERIC,
  longitude           NUMERIC,
  media_asset_id      UUID,
  received_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Structured Events (derived from messages)
-- --------------------------------------------------------
CREATE TABLE events (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID    NOT NULL REFERENCES companies(id),
  user_id           UUID    NOT NULL REFERENCES users(id),
  site_id           UUID    REFERENCES sites(id),
  post_id           UUID    REFERENCES posts(id),
  source_message_id UUID    REFERENCES messages(id),
  event_type        TEXT    NOT NULL CHECK (event_type IN (
                      'checkin', 'patrol', 'incident', 'generic_update'
                    )),
  status            TEXT    NOT NULL CHECK (status IN (
                      'verified', 'unverified', 'pending_review'
                    )),
  description       TEXT,
  latitude          NUMERIC,
  longitude         NUMERIC,
  occurred_at       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Incident Details (one-to-one with events of type 'incident')
-- --------------------------------------------------------
CREATE TABLE incidents (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID    UNIQUE NOT NULL REFERENCES events(id),
  severity            TEXT    NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category            TEXT,
  description         TEXT,
  requires_escalation BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Verification Results (one-to-one with events)
-- --------------------------------------------------------
CREATE TABLE verification_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID UNIQUE NOT NULL REFERENCES events(id),
  location_status TEXT CHECK (location_status IN ('match', 'mismatch', 'missing')),
  time_status     TEXT CHECK (time_status IN ('within_window', 'outside_window', 'unknown')),
  photo_status    TEXT CHECK (photo_status IN ('provided', 'missing', 'not_required')),
  overall_status  TEXT NOT NULL CHECK (overall_status IN (
                    'verified', 'unverified', 'pending_review'
                  )),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Media Assets (linked to messages and/or events)
-- --------------------------------------------------------
CREATE TABLE media_assets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID REFERENCES companies(id),
  message_id     UUID REFERENCES messages(id),
  event_id       UUID REFERENCES events(id),
  storage_bucket TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  mime_type      TEXT,
  public_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Indexes — `database/indexes.sql`

```sql
-- ============================================================
-- GuardOps Performance Indexes
-- ============================================================

CREATE INDEX idx_users_phone
  ON users(phone_number);

CREATE INDEX idx_messages_received_at
  ON messages(received_at DESC);

CREATE INDEX idx_events_occurred_at
  ON events(occurred_at DESC);

CREATE INDEX idx_events_user_occurred
  ON events(user_id, occurred_at DESC);

CREATE INDEX idx_events_site_occurred
  ON events(site_id, occurred_at DESC);

CREATE INDEX idx_incidents_severity
  ON incidents(severity);

CREATE INDEX idx_guard_assignments_user_active
  ON guard_assignments(user_id, active);
```

---

## 4. Storage Buckets

Create these two buckets in the Supabase dashboard (Storage → New Bucket):

| Bucket name       | Public | Purpose                                      |
|-------------------|--------|----------------------------------------------|
| `incident-media`  | false  | Incident photos and evidence uploaded by guards |
| `message-media`   | false  | General message media (voice notes, images)  |

Both buckets should be **private** (not publicly listed). Generate signed URLs on-demand when serving media to authorised users.

---

## 5. Seed Data — `database/seed.sql`

Use fixed UUIDs so development data is predictable across environments. Insert in dependency order.

```sql
-- ============================================================
-- GuardOps Seed Data — Development / Testing
-- Company: Safeguard Security Services, Cape Town
-- ============================================================

-- --------------------------------------------------------
-- 1. Company
-- --------------------------------------------------------
INSERT INTO companies (id, name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Safeguard Security Services'
);

-- --------------------------------------------------------
-- 2. Users
-- --------------------------------------------------------
-- Supervisors
INSERT INTO users (id, company_id, full_name, phone_number, role) VALUES
(
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Michael Daniels',
  '+27710000001',
  'supervisor'
),
(
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Nomsa Khumalo',
  '+27710000002',
  'supervisor'
);

-- Guards
INSERT INTO users (id, company_id, full_name, phone_number, role) VALUES
(
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Sipho Dlamini',
  '+27720000001',
  'guard'
),
(
  '00000000-0000-0000-0001-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'Thabo Mokoena',
  '+27720000002',
  'guard'
),
(
  '00000000-0000-0000-0001-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'Anele Jacobs',
  '+27720000003',
  'guard'
),
(
  '00000000-0000-0000-0001-000000000006',
  '00000000-0000-0000-0000-000000000001',
  'Lutho Ndlovu',
  '+27720000004',
  'guard'
);

-- --------------------------------------------------------
-- 3. Sites
-- --------------------------------------------------------
INSERT INTO sites (id, company_id, name, address, latitude, longitude, allowed_radius_meters) VALUES
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Cavendish Retail Complex',
  'Dreyer St, Claremont, Cape Town',
  -33.9806, 18.4654, 150
),
(
  '00000000-0000-0000-0002-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Montague Industrial Park',
  'Montague Dr, Montague Gardens, Cape Town',
  -33.8647, 18.5361, 250
),
(
  '00000000-0000-0000-0002-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Sea Point Residential Block',
  'Main Rd, Sea Point, Cape Town',
  -33.9155, 18.3847, 120
);

-- --------------------------------------------------------
-- 4. Guard Assignments
-- Sipho  → Cavendish   day   06:00–18:00 (supervisor: Michael)
-- Thabo  → Montague    day   06:00–18:00 (supervisor: Michael)
-- Anele  → Sea Point   night 18:00–06:00 (supervisor: Nomsa)
-- Lutho  → Cavendish   night 18:00–06:00 (supervisor: Nomsa)
-- --------------------------------------------------------
INSERT INTO guard_assignments (id, user_id, site_id, shift_start, shift_end) VALUES
(
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0001-000000000003',  -- Sipho
  '00000000-0000-0000-0002-000000000001',  -- Cavendish
  '2026-03-28 06:00:00+02', '2026-03-28 18:00:00+02'
),
(
  '00000000-0000-0000-0003-000000000002',
  '00000000-0000-0000-0001-000000000004',  -- Thabo
  '00000000-0000-0000-0002-000000000002',  -- Montague
  '2026-03-28 06:00:00+02', '2026-03-28 18:00:00+02'
),
(
  '00000000-0000-0000-0003-000000000003',
  '00000000-0000-0000-0001-000000000005',  -- Anele
  '00000000-0000-0000-0002-000000000003',  -- Sea Point
  '2026-03-27 18:00:00+02', '2026-03-28 06:00:00+02'
),
(
  '00000000-0000-0000-0003-000000000004',
  '00000000-0000-0000-0001-000000000006',  -- Lutho
  '00000000-0000-0000-0002-000000000001',  -- Cavendish
  '2026-03-27 18:00:00+02', '2026-03-28 06:00:00+02'
);

-- --------------------------------------------------------
-- 5. Messages (raw inbound WhatsApp payloads)
-- --------------------------------------------------------
-- Message for Event 1: Sipho check-in at Cavendish
INSERT INTO messages (id, company_id, user_id, direction, message_type, raw_payload_json, latitude, longitude, received_at) VALUES
(
  '00000000-0000-0000-0004-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000003',  -- Sipho
  'inbound',
  'location',
  '{"type":"location","location":{"latitude":-33.9804,"longitude":18.4655}}',
  -33.9804, 18.4655,
  '2026-03-28 06:02:00+02'
);

-- Message for Event 2: Thabo patrol at Montague (text only, no location)
INSERT INTO messages (id, company_id, user_id, direction, message_type, raw_payload_json, text_body, received_at) VALUES
(
  '00000000-0000-0000-0004-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000004',  -- Thabo
  'inbound',
  'text',
  '{"type":"text","text":{"body":"Patrol complete, all clear."}}',
  'Patrol complete, all clear.',
  '2026-03-28 08:15:00+02'
);

-- Message for Event 3: Anele incident at Sea Point
INSERT INTO messages (id, company_id, user_id, direction, message_type, raw_payload_json, text_body, latitude, longitude, received_at) VALUES
(
  '00000000-0000-0000-0004-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000005',  -- Anele
  'inbound',
  'text',
  '{"type":"text","text":{"body":"Suspicious person at rear entrance. Moving to investigate."}}',
  'Suspicious person at rear entrance. Moving to investigate.',
  -33.9156, 18.3849,
  '2026-03-27 21:40:00+02'
);

-- --------------------------------------------------------
-- 6. Events
-- --------------------------------------------------------
-- Event 1: Verified check-in — Sipho at Cavendish
INSERT INTO events (id, company_id, user_id, site_id, source_message_id, event_type, status, description, latitude, longitude, occurred_at) VALUES
(
  '00000000-0000-0000-0005-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000003',  -- Sipho
  '00000000-0000-0000-0002-000000000001',  -- Cavendish
  '00000000-0000-0000-0004-000000000001',  -- source message
  'checkin',
  'verified',
  'Guard checked in at start of day shift.',
  -33.9804, 18.4655,
  '2026-03-28 06:02:00+02'
);

-- Event 2: Unverified patrol — Thabo at Montague (no location provided)
INSERT INTO events (id, company_id, user_id, site_id, source_message_id, event_type, status, description, occurred_at) VALUES
(
  '00000000-0000-0000-0005-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000004',  -- Thabo
  '00000000-0000-0000-0002-000000000002',  -- Montague
  '00000000-0000-0000-0004-000000000002',  -- source message
  'patrol',
  'unverified',
  'Patrol complete, all clear.',
  '2026-03-28 08:15:00+02'
);

-- Event 3: Verified incident — Anele at Sea Point
INSERT INTO events (id, company_id, user_id, site_id, source_message_id, event_type, status, description, latitude, longitude, occurred_at) VALUES
(
  '00000000-0000-0000-0005-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000005',  -- Anele
  '00000000-0000-0000-0002-000000000003',  -- Sea Point
  '00000000-0000-0000-0004-000000000003',  -- source message
  'incident',
  'verified',
  'Suspicious person at rear entrance.',
  -33.9156, 18.3849,
  '2026-03-27 21:40:00+02'
);

-- --------------------------------------------------------
-- 7. Verification Results
-- --------------------------------------------------------
-- Verification for Event 1 (Sipho check-in — verified)
INSERT INTO verification_results (id, event_id, location_status, time_status, photo_status, overall_status, notes) VALUES
(
  '00000000-0000-0000-0006-000000000001',
  '00000000-0000-0000-0005-000000000001',
  'match',
  'within_window',
  'not_required',
  'verified',
  'Location within 150m radius. Shift started on time.'
);

-- Verification for Event 2 (Thabo patrol — unverified, no location)
INSERT INTO verification_results (id, event_id, location_status, time_status, photo_status, overall_status, notes) VALUES
(
  '00000000-0000-0000-0006-000000000002',
  '00000000-0000-0000-0005-000000000002',
  'missing',
  'within_window',
  'not_required',
  'unverified',
  'No location provided with patrol message.'
);

-- Verification for Event 3 (Anele incident — verified)
INSERT INTO verification_results (id, event_id, location_status, time_status, photo_status, overall_status, notes) VALUES
(
  '00000000-0000-0000-0006-000000000003',
  '00000000-0000-0000-0005-000000000003',
  'match',
  'within_window',
  'missing',
  'verified',
  'Location confirmed within Sea Point site radius. Photo not yet provided.'
);

-- --------------------------------------------------------
-- 8. Incidents
-- --------------------------------------------------------
-- Incident linked to Event 3 (Anele at Sea Point)
INSERT INTO incidents (id, event_id, severity, category, description, requires_escalation) VALUES
(
  '00000000-0000-0000-0007-000000000001',
  '00000000-0000-0000-0005-000000000003',
  'high',
  'Suspicious Person',
  'Suspicious person at rear entrance. Moving to investigate.',
  true
);
```

---

## 6. Database Rules

### Naming Conventions
- Table names: **plural, lowercase, underscore-separated** (e.g. `guard_assignments`, not `GuardAssignment`)
- Column names: lowercase, underscore-separated
- Foreign key columns: `<table_singular>_id` (e.g. `site_id`, `user_id`)
- Boolean flags: prefix with a descriptive verb (`active`, `requires_escalation`)

### Constraints
- Use `CHECK` constraints for all enumerated string fields — never rely solely on application-layer validation
- All primary keys: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- All timestamps: `TIMESTAMPTZ` (timezone-aware) — never use `TIMESTAMP` without time zone
- Foreign keys should have explicit `REFERENCES` clauses at column definition

### Immutability
- **`messages` rows are immutable.** Never `UPDATE` a message record after insert
- All business logic works from `events`, which are derived from messages
- If a message needs correction, insert a new corrective message and link it

### Linkage
- Always populate `source_message_id` on `events` when the event originates from a WhatsApp message
- Always populate `event_id` on `media_assets` when the media relates to an event
- `verification_results` and `incidents` are one-to-one with `events` (enforced by `UNIQUE NOT NULL`)

### Normalisation
- Avoid denormalisation unless it directly solves an MVP performance bottleneck
- Keep `companies` as the top-level tenant boundary — every user and site belongs to a company

---

## 7. Python DB Access Patterns

### Client Initialisation

```python
# backend/app/db/client.py
from supabase import create_client, Client
from app.config import settings

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)
```

### Query Functions

- Define all database operations as **named functions** in the `backend/app/db/` module
- Never write inline Supabase queries inside service or route files
- Return typed results using **Pydantic models** defined in `backend/app/models/`
- Handle all query errors gracefully — catch exceptions and raise domain-specific errors

```python
# backend/app/db/events.py
from uuid import UUID
from app.db.client import supabase
from app.models.event import Event

def get_events_for_site(site_id: UUID, limit: int = 50) -> list[Event]:
    response = (
        supabase.table("events")
        .select("*")
        .eq("site_id", str(site_id))
        .order("occurred_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [Event(**row) for row in response.data]

def insert_event(payload: dict) -> Event:
    response = supabase.table("events").insert(payload).execute()
    return Event(**response.data[0])
```

### Storage Access

```python
# backend/app/db/storage.py
from app.db.client import supabase

def upload_incident_media(file_bytes: bytes, path: str, mime_type: str) -> str:
    """Upload to incident-media bucket, return storage path."""
    supabase.storage.from_("incident-media").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": mime_type},
    )
    return path

def get_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """Generate a short-lived signed URL for private media."""
    response = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
    return response["signedURL"]
```

### Module Structure

```
backend/
  app/
    db/
      __init__.py
      client.py          # Supabase client singleton
      events.py          # Event CRUD operations
      messages.py        # Message insert (read-only after insert)
      incidents.py       # Incident and verification queries
      users.py           # User lookup by phone number
      storage.py         # Storage bucket helpers
    models/
      company.py
      user.py
      site.py
      event.py
      incident.py
      verification_result.py
      media_asset.py
```
