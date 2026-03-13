Build a WhatsApp-native security operations MVP with a full working architecture. Focus on **structure and functionality**, not visual styling. The MVP must be:

- Fast to build
- Cheap to run
- Stable with WhatsApp
- Easy to iterate

---

# Complete Architecture

WhatsApp Cloud API → FastAPI Webhook → Redis Queue → Message Processor → Event Engine + Verification Layer → PostgreSQL (Supabase) → Supabase Storage → Next.js Dashboard → Map Visualization (Mapbox or Leaflet) → Supervisor Notifications (WhatsApp / Email)

Key points:

- Guards use WhatsApp only; no new app installation.
- All messages (text, location, media) pass through FastAPI webhook.
- Verification layer ensures check-ins, patrols, and incidents are verified with geolocation and optional photo.
- Redis queue handles async processing to prevent webhook timeouts.
- Events stored in PostgreSQL with media URLs in Supabase Storage.
- Dashboard displays live feed, map, verified/unverified status, and alerts.

---

# Requirements

## 1. WhatsApp Integration
- Use WhatsApp Cloud API from Meta Platforms.
- Webhook endpoint: POST /webhook/whatsapp
- Support incoming messages:
  - Text messages: "checkin", "patrol done sector X", "incident description"
  - Location messages
  - Media: photos, voice notes
- Support outgoing messages:
  - Instructions
  - Alerts / notifications
  - Verification requests (if check-in location missing or unverified)

---

## 2. Backend (FastAPI)
Folder structure:

backend/
 ├── main.py                 # Entry point for FastAPI
 ├── routes/
 │    └── whatsapp.py        # Webhook endpoints
 ├── services/
 │    ├── message_processor.py # Async job processor
 │    └── event_engine.py      # Event logic + verification
 └── models/
      ├── user.py
      ├── company.py
      ├── event.py
      ├── incident.py
      └── message.py

Responsibilities:

- Webhook receives messages → push to Redis queue
- Message Processor pulls jobs → identifies user by phone number → stores raw message → sends to Event Engine
- Event Engine:
  - Detects event type: checkin, patrol, incident
  - Runs verification:
    - Geolocation matches expected location
    - Check-in within scheduled time
    - Optional photo verification
  - Flags event verified/unverified
  - Stores structured event in PostgreSQL
  - Triggers supervisor notifications if needed

---

## 3. Async Processing
- Use Redis + RQ (Redis Queue)
- Workflow:
  - Webhook receives message → push job to Redis queue → worker processes in background
- Prevents webhook timeout and enables scalable async processing

---

## 4. Database (PostgreSQL via Supabase)
- Tables:
  - companies
  - users
  - events
  - incidents
  - messages
- Stores structured event data:
  - Guard ID
  - Timestamps
  - Location
  - Media URLs
  - Verification status
- Supabase Storage for media (images, voice notes)
- Simplifies hosting and authentication

---

## 5. Dashboard Frontend (Next.js + Tailwind)
- Pages:
  - /dashboard → live feed of events, map, verified/unverified status
  - /incidents → list incidents with photo, location, timestamp
  - /guards → list guards and latest activity
  - /activity → real-time activity feed
- Map component (Mapbox or Leaflet):
  - Guard locations
  - Incident points
  - Patrol routes
  - Visual differentiation for verified/unverified
- Notifications:
  - Display alert banners for incidents or unverified events
  - Optional WhatsApp or email notifications

---

## 6. Functional Flows

**Guard Check-in**
1. Guard sends "checkin" + location (+ optional photo)
2. WhatsApp Cloud API → webhook → Redis queue
3. Message Processor identifies guard, stores message
4. Event Engine verifies location/time/photo → flags event
5. Database stores structured event
6. Dashboard updates live feed & map
7. Notifications sent if unverified

**Incident Reporting**
1. Guard sends "incident" + photo + location
2. Same processing pipeline
3. Supervisor receives alert and sees incident on dashboard

**Patrol Logging**
1. Guard sends "patrol done sector X"
2. Processed into event → dashboard map updates patrol route

---

## 7. Hosting & Deployment
- Backend: Railway
- Frontend: Vercel
- Media storage and DB: Supabase
- Logging/Debugging: Sentry

---

# Deliverable Requirements
- Fully scaffolded project:
  - Backend (FastAPI) + Redis async queue + WhatsApp webhook + Event Engine
  - Database (Supabase PostgreSQL) + media storage (Supabase Storage)
  - Frontend (Next.js) + Map visualization
- End-to-end working functionality:
  - Check-ins, patrols, incident reporting
  - Verification layer (location, time, photo)
  - Dashboard live feed & map
  - Supervisor notifications (WhatsApp / email)
- Include **comments in all files** explaining purpose and flow
- Prioritize **architecture and functionality**, not styling

---

# Notes for Cursor
- Generate folder scaffolding with placeholder files and sample code snippets where necessary.
- Ensure WhatsApp integration templates are included.
- Include Redis async job setup.
- Include Supabase DB integration and media storage.
- Include Next.js dashboard pages with map component placeholders.
- Focus on MVP functionality end-to-end.