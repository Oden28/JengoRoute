# JengoRoute

# JengoRoute MVP

JengoRoute is a WhatsApp-native security operations system for South African security companies.

The product turns WhatsApp messages from guards into structured operational events for supervisors. Guards do not install a new mobile app. They use WhatsApp to submit check-ins, patrol updates, incident reports, location pins, and media. Supervisors use a web dashboard to monitor activity, verify events, and respond to incidents.

## MVP Goal

Build a fast, cheap, stable, easy-to-iterate MVP with this pipeline:

WhatsApp Cloud API → FastAPI Webhook → Redis Queue → Message Processor → Event Engine + Verification Layer → PostgreSQL (Supabase) → Supabase Storage → Next.js Dashboard → Map Visualization → Supervisor Notifications

## Core Product Idea

Security companies in South Africa already use WhatsApp operationally, but they do so in an unstructured way. This product converts unstructured chat into operational intelligence.

Core value:
- verified check-ins
- patrol logging
- incident reporting
- supervisor visibility
- real-time alerts
- low training overhead

## Primary Users

- Guards: send updates through WhatsApp
- Supervisors: monitor dashboard and receive alerts
- Security company admins: manage companies, users, sites, and reports

## MVP Scope

Included:
- WhatsApp webhook ingestion
- text, location, and image handling
- async processing with Redis/RQ
- message storage
- event detection
- verification layer
- incident and patrol flows
- dashboard pages
- map visualization
- supervisor alerting

Excluded for v1:
- payroll
- advanced AI/NLP
- biometric identity verification
- route optimization
- client-facing reporting portals
- multi-tenant billing automation
- native mobile app

## Tech Stack

- WhatsApp Cloud API
- FastAPI
- Redis + RQ
- Supabase PostgreSQL
- Supabase Storage
- Next.js
- Tailwind CSS
- Mapbox or Leaflet
- Railway
- Vercel
- Sentry

## Local Development

### Backend
- FastAPI app
- Redis worker
- Supabase connection
- WhatsApp webhook endpoint

### Frontend
- Next.js app
- dashboard pages
- polling or realtime updates from backend

## Deployment Targets

- Backend: Railway
- Frontend: Vercel
- Database and media: Supabase
- Error monitoring: Sentry

## Guiding Principle
Optimize for operational correctness, reliability, and clear architecture.

Quick start

1. Database — Run backend/db/schema.sql in Supabase SQL Editor

#backend
```bash
cd backend
cp .env.example .env        # Fill in real values
pip install -r requirements.txt
docker-compose up -d redis   # Start Redis
uvicorn main:app --reload    # Start API server
python worker.py             # Start queue worker (separate terminal)
```

#frontend
```bash
cd frontend
cp .env.example .env.local   # Fill in real values
npm install
npm run dev
```