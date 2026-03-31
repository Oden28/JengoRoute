---
description: Master project rule for JengoRoute — always apply for full project context, architecture, domain concepts, and engineering standards
globs: 
alwaysApply: true
---

# JengoRoute MVP — Master Project Rule

## 1. Project Identity

**Product:** JengoRoute MVP

JengoRoute is a **WhatsApp-first security guard operations platform** built for South African security companies.

- **Guards** interact exclusively via WhatsApp — no app install required
- **Supervisors** use a web dashboard (Next.js) for real-time situational awareness
- **Target market:** 16,000+ licensed security companies in South Africa employing 600,000+ guards
- **MVP scope:** Check-ins, patrols, incident reporting, guard verification, supervisor alerting

This is a lean MVP. Every technical decision should optimise for speed-to-market, operational reliability, and simplicity — not theoretical scale or feature completeness.

---

## 2. Architecture Overview

```
WhatsApp Cloud API
        │
        ▼
FastAPI Webhook (POST /webhook/whatsapp)
        │  receive → validate token → enqueue → return 200
        ▼
Redis Queue (RQ / python-rq)
        │  async job dispatch
        ▼
Message Processor (services/message_processor.py)
        │  parse intent, extract data
        ▼
Event Engine (services/event_engine.py)
        │  create structured Event record
        ▼
Verification Layer (services/verification.py)
        │  assess location / time / photo trust
        ▼
PostgreSQL via Supabase + Supabase Storage (media)
        │
        ▼
Next.js Dashboard (real-time updates via polling or Supabase Realtime)
        │
        ▼
Notifications (services/notification.py → supervisor WhatsApp alerts)
```

**Key principle:** The webhook path must be as short as possible. All heavy processing happens asynchronously in the worker.

---

## 3. Tech Stack

### Backend
| Concern | Choice |
|---|---|
| Language | Python 3.11+ |
| Web framework | FastAPI |
| Async job queue | Redis + RQ (`python-rq`) |
| Database | Supabase (PostgreSQL) |
| Media storage | Supabase Storage |
| HTTP client | `httpx` (async) |
| Env management | `python-dotenv` / Railway env vars |
| Error tracking | Sentry (`sentry-sdk`) |

### Frontend
| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS |
| Maps | Leaflet **or** Mapbox (configurable via env var) |
| Data fetching | `fetch` / SWR or React Query |
| Hosting | Vercel |

### Infrastructure
| Service | Provider |
|---|---|
| Backend hosting | Railway |
| Frontend hosting | Vercel |
| Database + storage | Supabase |
| Cache + queue broker | Railway Redis |

---

## 4. Project Structure

```
JengoRoute/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry — mounts routes, sets up Sentry
│   │   ├── config.py            # Pydantic Settings — reads all env vars, single source of truth
│   │   ├── routes/
│   │   │   ├── webhook.py       # POST /webhook/whatsapp — thin: validate, enqueue, return 200
│   │   │   └── api.py           # Internal dashboard API routes (guards, events, incidents, sites)
│   │   ├── services/
│   │   │   ├── message_processor.py  # Parse inbound WhatsApp payload → intent + structured data
│   │   │   ├── event_engine.py       # Create/update Event records from processed messages
│   │   │   ├── verification.py       # Produce VerificationResult per event
│   │   │   ├── whatsapp.py           # Outbound WhatsApp Cloud API calls
│   │   │   └── notification.py       # Supervisor alerting logic
│   │   ├── models/              # Pydantic models (request/response schemas, domain types)
│   │   ├── db/                  # Supabase client singleton + query helpers
│   │   └── worker.py            # RQ worker entry point
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/       # Overview: active guards, incident map, stats
│   │   │   ├── incidents/       # Incident list + detail view
│   │   │   ├── guards/          # Guard roster, assignment management
│   │   │   └── activity/        # Chronological event feed
│   │   ├── components/          # Shared UI components
│   │   └── lib/                 # API client, utilities, type definitions
│   ├── tailwind.config.ts
│   └── .env.local.example
├── database/
│   ├── schema.sql               # Full table definitions with RLS policies
│   └── seed.sql                 # Dev seed data (companies, sites, test guards)
└── docs/
    ├── architecture.md
    └── whatsapp-flows.md
```

---

## 5. Engineering Rules (CRITICAL — always enforce)

### 5.1 Webhook Handler Rules
- **Thin handlers only.** Webhook route does three things: validate the WhatsApp verify token, enqueue the raw payload as an RQ job, return `{"status": "ok"}` with HTTP 200.
- Never do database writes, external HTTP calls, or business logic inside a route handler.
- Return 200 even if enqueue fails — log the error, never let Meta retry flood the queue.

### 5.2 Service Layer Rules
- All business logic lives in `services/` — never in `routes/`.
- Services are plain Python classes or functions — no FastAPI dependencies injected.
- Each service has a single responsibility (see structure above).
- Services communicate by calling each other directly; no event bus or internal pub/sub.

### 5.3 Data Integrity Rules
- **Store raw payloads first.** Persist the full inbound WhatsApp JSON to the `messages` table before any parsing or transformation.
- **Verification is explicit.** Every event must have a corresponding `VerificationResult` record. Do not infer trust from event status fields.
- **Immutable message records.** The `messages` table is append-only. Never update or delete message rows.
- Use database constraints and enums to enforce status values at the DB level, not just in application code.

### 5.4 Code Style Rules
- Use **type hints** everywhere in Python. No untyped function signatures.
- Use **TypeScript** (strict mode) in the frontend — no `any` unless absolutely unavoidable.
- Use **Pydantic v2** models for all FastAPI request/response schemas and domain objects.
- Use **`python-dotenv`** in dev; read config exclusively via the `Settings` class in `config.py`.
- Keep functions small and testable — a function doing more than one logical thing should be split.
- **Comment non-obvious logic** — especially WhatsApp payload parsing, verification scoring, and RQ job dispatch.
- Prefer explicit, readable code over clever abstractions.

### 5.5 Error Handling Rules
- All RQ jobs must have a `try/except` at the top level — log errors to Sentry, do not raise unhandled.
- FastAPI routes use structured error responses: `{"error": "message", "code": "ERROR_CODE"}`.
- Never expose raw exception messages to API consumers.

### 5.6 Configuration Rules
- **All secrets via environment variables** — no hardcoded tokens, keys, or URLs.
- The `config.py` `Settings` class is the single source of truth for configuration.
- Every new env var must also be added to `.env.example` with a descriptive comment.

### 5.7 Scope Rules (DO NOT ADD)
- No AI chat / LLM integration
- No advanced scheduling engine
- No multi-tenant billing / SaaS payment flows
- No native mobile app (iOS/Android)
- No microservice decomposition — keep it a monorepo monolith for MVP
- No WebSocket server — use polling or Supabase Realtime for dashboard updates

---

## 6. Environment Variables

### Backend (`backend/.env`)
```bash
# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=          # Meta permanent system user token
WHATSAPP_PHONE_NUMBER_ID=       # WhatsApp Business phone number ID
WHATSAPP_VERIFY_TOKEN=          # Arbitrary secret for webhook verification handshake

# Supabase
SUPABASE_URL=                   # https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=      # Service role key (never expose to frontend)

# Redis
REDIS_URL=                      # redis://:password@host:6379

# Monitoring
SENTRY_DSN=                     # Sentry project DSN

# App
ENVIRONMENT=development         # development | staging | production
```

### Frontend (`frontend/.env.local`)
```bash
NEXT_PUBLIC_API_BASE_URL=       # Backend Railway URL e.g. https://JengoRoute-api.up.railway.app
NEXT_PUBLIC_MAP_PROVIDER=       # leaflet | mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=       # Required only if MAP_PROVIDER=mapbox
```

---

## 7. Core Domain Concepts

These are the canonical domain entities. Use these exact names in table names, Pydantic models, and TypeScript types.

| Entity | Description |
|---|---|
| `Company` | A security company using JengoRoute |
| `User` | A guard, supervisor, or admin. Primary identifier is `phone_number`. Role: `guard` \| `supervisor` \| `admin` |
| `Site` | A protected location with `lat`, `lng`, `radius_metres` |
| `Post` | A specific guard station within a site |
| `GuardAssignment` | Links a `User` (guard) to a `Site`/`Post` with `shift_start` and `shift_end` |
| `Message` | Immutable raw record of every inbound/outbound WhatsApp message |
| `Event` | Structured operational record derived from a message. `event_type`: `checkin` \| `patrol` \| `incident` \| `generic_update` |
| `Incident` | Extended detail record attached to an `incident` Event. `severity`: `low` \| `medium` \| `high` \| `critical` |
| `VerificationResult` | Explicit trust assessment per Event. Fields: `location_status`, `time_status`, `photo_status`, `overall_status`. Values: `verified` \| `unverified` \| `not_applicable` |
| `MediaAsset` | Stored media (photo/audio) linked to a `Message` or `Event`. Stored in Supabase Storage. |

---

## 8. Primary Flows

### Check-in Flow
```
Guard WhatsApp: "checkin" + location share
  → Webhook receives message
  → Enqueue job (raw payload stored)
  → message_processor: detect intent=checkin, extract location
  → event_engine: create Event{type=checkin, guard_id, site_id, location}
  → verification: check location vs site radius, check time vs shift
  → Store VerificationResult
  → If unverified → notification.py → alert supervisor via WhatsApp
  → Dashboard updates (polling / Supabase Realtime)
```

### Incident Flow
```
Guard WhatsApp: incident description text + location share + photo
  → Webhook receives (may be multiple messages — handle each independently)
  → message_processor: detect intent=incident, extract text, location, media
  → event_engine: create Event{type=incident} + Incident{severity=...}
  → verification: verify location + photo presence
  → MediaAsset: download photo from WhatsApp API → upload to Supabase Storage
  → notification.py → alert all supervisors for that site
  → Dashboard incident map pin updated
```

### Patrol Flow
```
Guard WhatsApp: "patrol done sector A"
  → message_processor: detect intent=patrol, extract sector
  → event_engine: create Event{type=patrol}
  → verification: location check only
  → Dashboard activity feed updated
```

---

## 9. Code Generation Instructions

When generating code for this project, follow these rules:

1. **Scaffold complete, runnable modules** — not fragments or pseudocode. A generated file should be executable without modification beyond environment variables.

2. **Preserve architectural boundaries** — when modifying existing files, do not move logic between layers (e.g., do not add DB calls to route handlers).

3. **Always include `.env.example` updates** when introducing new environment variables.

4. **Python files must include:**
   - Module-level docstring describing purpose
   - Full type hints on all functions
   - Pydantic models for all structured data
   - Sentry error capture in job-level exception handlers
   - Logging via Python's `logging` module (not `print`)

5. **TypeScript/Next.js files must include:**
   - Strict TypeScript types — define interfaces in `src/lib/types.ts`
   - Error boundary handling for data-fetching components
   - Loading and error states for all async UI

6. **Database changes must include:**
   - Migration SQL in `database/schema.sql`
   - RLS (Row Level Security) policy statements
   - Index definitions for foreign keys and frequently queried columns

7. **Test stubs:** When scaffolding a new service, include a corresponding `tests/test_<service>.py` with at least one passing unit test.

8. **Comments:** Explain *why*, not *what*. Focus comments on business logic decisions, non-obvious WhatsApp API behaviours, and verification scoring rationale.
