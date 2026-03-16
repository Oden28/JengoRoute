# Database Schema

## Tables

### companies
- id uuid pk
- name text not null
- created_at timestamptz default now()
- updated_at timestamptz default now()

### users
- id uuid pk
- company_id uuid fk -> companies.id
- full_name text not null
- phone_number text unique not null
- role text not null
- active boolean default true
- created_at timestamptz default now()

Suggested role values:
- guard
- supervisor
- admin

### sites
- id uuid pk
- company_id uuid fk -> companies.id
- name text not null
- address text
- latitude numeric
- longitude numeric
- allowed_radius_meters integer default 200
- active boolean default true
- created_at timestamptz default now()

### posts
- id uuid pk
- site_id uuid fk -> sites.id
- name text not null
- latitude numeric
- longitude numeric
- allowed_radius_meters integer default 100
- active boolean default true
- created_at timestamptz default now()

### guard_assignments
- id uuid pk
- user_id uuid fk -> users.id
- site_id uuid fk -> sites.id
- post_id uuid fk -> posts.id nullable
- shift_start timestamptz
- shift_end timestamptz
- active boolean default true
- created_at timestamptz default now()

### messages
- id uuid pk
- company_id uuid fk -> companies.id nullable
- user_id uuid fk -> users.id nullable
- direction text not null
- whatsapp_message_id text
- message_type text not null
- raw_payload_json jsonb not null
- text_body text
- latitude numeric
- longitude numeric
- media_asset_id uuid nullable
- received_at timestamptz
- created_at timestamptz default now()

### events
- id uuid pk
- company_id uuid fk -> companies.id
- user_id uuid fk -> users.id
- site_id uuid fk -> sites.id nullable
- post_id uuid fk -> posts.id nullable
- source_message_id uuid fk -> messages.id nullable
- event_type text not null
- status text not null
- description text
- latitude numeric
- longitude numeric
- occurred_at timestamptz not null
- created_at timestamptz default now()

Suggested event_type values:
- checkin
- patrol
- incident
- generic_update

Suggested status values:
- verified
- unverified
- pending_review

### incidents
- id uuid pk
- event_id uuid fk -> events.id unique
- severity text not null
- category text
- description text
- requires_escalation boolean default false
- created_at timestamptz default now()

### verification_results
- id uuid pk
- event_id uuid fk -> events.id unique
- location_status text
- time_status text
- photo_status text
- overall_status text not null
- notes text
- created_at timestamptz default now()

### media_assets
- id uuid pk
- company_id uuid fk -> companies.id nullable
- message_id uuid fk -> messages.id nullable
- event_id uuid fk -> events.id nullable
- storage_bucket text not null
- storage_path text not null
- mime_type text
- public_url text
- created_at timestamptz default now()

## Index Suggestions

- index users(phone_number)
- index messages(received_at desc)
- index events(occurred_at desc)
- index events(user_id, occurred_at desc)
- index events(site_id, occurred_at desc)
- index incidents(severity)
- index guard_assignments(user_id, active)

## Storage Buckets

Suggested buckets:
- `incident-media`
- `message-media`

## Notes

- store raw webhook payloads for audit/debugging
- keep verification results separate from events for clarity