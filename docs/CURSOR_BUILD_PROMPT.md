# Cursor Build Prompt

Build a WhatsApp-native security operations MVP with a full working architecture. Focus on structure and functionality, not visual styling. The MVP must be fast to build, cheap to run, stable with WhatsApp, and easy to iterate.

## Complete Architecture

WhatsApp Cloud API → FastAPI Webhook → Redis Queue → Message Processor → Event Engine + Verification Layer → PostgreSQL (Supabase) → Supabase Storage → Next.js Dashboard → Map Visualization (Mapbox or Leaflet) → Supervisor Notifications (WhatsApp / Email)

## Key Points

- Guards use WhatsApp only; no new app installation.
- All messages pass through FastAPI webhook.
- Verification layer ensures check-ins, patrols, and incidents are verified with geolocation and optional photo.
- Redis queue handles async processing to prevent webhook timeouts.
- Events are stored in PostgreSQL with media URLs in Supabase Storage.
- Dashboard displays live feed, map, verified/unverified status, and alerts.

## Requirements

### WhatsApp Integration
- Use WhatsApp Cloud API from Meta Platforms
- Configure `POST /webhook/whatsapp`
- Support text, location, and media
- Support outbound acknowledgements, alerts, and prompts

### Backend
- Use FastAPI
- Webhook receives messages and pushes jobs to Redis queue
- Message Processor identifies user, stores raw message, detects event type
- Event Engine converts messages into structured events
- Verification checks location, time, and optional photo
- Stores structured event in PostgreSQL
- Triggers supervisor notifications if needed

### Async Processing
- Use Redis + RQ
- Webhook should enqueue quickly
- Worker processes in background

### Database
- Use Supabase PostgreSQL
- Tables include companies, users, sites, posts, guard_assignments, messages, events, incidents, verification_results, media_assets

### Media Storage
- Use Supabase Storage
- Store incoming media and save URLs in DB

### Frontend
- Use Next.js + Tailwind
- Pages: `/dashboard`, `/incidents`, `/guards`, `/activity`
- Include map view
- Include verified/unverified indicators
- Include incident visibility and activity feed

### Hosting
- Backend on Railway
- Frontend on Vercel
- Supabase for DB/storage
- Sentry for logging

## Functional Flows

### Guard Check-In
1. Guard sends "checkin" + location (+ optional photo)
2. Webhook receives payload
3. Queue processes payload
4. Raw message stored
5. Event engine creates check-in event
6. Verification layer checks time/location/photo
7. Event + verification stored
8. Dashboard updates
9. Supervisor alerted if unverified

### Incident Reporting
1. Guard sends incident description + location + optional photo
2. Message processed through same pipeline
3. Incident record created
4. Alert sent to supervisor
5. Dashboard map displays incident

### Patrol Logging
1. Guard sends patrol message
2. Event engine creates patrol event
3. Dashboard activity and map update

## Build Expectations

- scaffold a working full-stack project
- generate runnable code where possible
- keep architecture clean and explicit
- focus on end-to-end functionality before polish
- include comments in important files