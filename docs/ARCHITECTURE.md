# Architecture

## High-Level System

WhatsApp Cloud API → FastAPI Webhook → Redis Queue → Message Processor → Event Engine + Verification Layer → PostgreSQL (Supabase) + Supabase Storage → Next.js Dashboard → Notifications

## Architectural Goal

Build a lean operations platform that converts WhatsApp traffic into structured operational records with verifiable state.

## Major Components

### 1. WhatsApp Cloud API
Purpose:
- receives inbound guard messages
- sends outbound replies, prompts, and alerts

Inbound supported content:
- text
- location
- image
- voice note (store now, parse later if needed)

Outbound supported content:
- acknowledgement messages
- prompts for missing location
- supervisor notifications
- incident escalation alerts

### 2. FastAPI Webhook
Purpose:
- public endpoint that receives WhatsApp webhook payloads
- validates payload shape
- extracts relevant message metadata
- immediately queues a job
- returns quickly to avoid timeout

Key route:
- `POST /webhook/whatsapp`

Important rule:
Webhook should do minimal work synchronously.

### 3. Redis Queue + Worker
Purpose:
- decouple webhook receipt from message processing
- avoid slow webhook responses
- support retries and background handling

Pattern:
- webhook receives payload
- enqueue processing job
- worker picks up job
- worker calls message processor

### 4. Message Processor
Purpose:
- normalize incoming WhatsApp payloads
- identify company/user context
- store raw message
- classify message content
- pass normalized input to event engine

Responsibilities:
- extract sender phone number
- map sender to user
- identify message type
- download media metadata if needed
- save raw record in `messages`
- call event engine with normalized message object

### 5. Event Engine
Purpose:
- translate normalized messages into domain events

Supported event families:
- check-in
- patrol update
- incident report
- generic operational message

Examples:
- “checkin”
- “checked in”
- “patrol done sector x”
- “incident at gate 2”
- media + location attached to incident flow

Event engine outputs:
- structured event
- verification result
- incident row if applicable
- supervisor notification triggers

### 6. Verification Layer
Purpose:
Determine whether a reported event should be considered trusted.

MVP verification dimensions:
- location present or absent
- location within allowed radius of assigned site/post
- timestamp within expected shift or acceptable window
- optional photo attached
- optional manual supervisor override

Possible statuses:
- verified
- unverified
- pending_review

### 7. PostgreSQL via Supabase
Purpose:
- persistent storage for operational data

Main entities:
- companies
- sites
- users
- guard assignments
- messages
- events
- incidents
- media_assets

### 8. Supabase Storage
Purpose:
- persist image and voice-note files
- provide retrievable URLs for dashboard

Flow:
- receive media reference from WhatsApp
- download media
- upload to Supabase Storage
- store metadata and public/signed URL in DB

### 9. Dashboard (Next.js)
Purpose:
- show live operational status to supervisors

Views:
- dashboard summary
- incidents list
- guards list
- activity feed
- map

### 10. Notifications
Purpose:
- notify supervisors when a critical event occurs

Initial triggers:
- incident created
- unverified check-in
- missing location on check-in
- high-priority event

Channels:
- WhatsApp outbound message
- optional email

## End-to-End Flow: Check-In

1. Guard sends “checkin” with location
2. WhatsApp sends webhook payload
3. FastAPI webhook receives payload
4. Payload is queued in Redis
5. Worker processes message
6. Message processor stores raw message
7. Event engine creates check-in event
8. Verification layer checks distance/time/photo
9. Event stored in DB
10. Dashboard updates
11. Notification sent if verification fails

## End-to-End Flow: Incident

1. Guard sends incident text, location, optional photo
2. Webhook receives payload
3. Queue processes event
4. Message stored
5. Incident event created
6. Media uploaded to storage
7. Incident row stored
8. Supervisor alerted
9. Dashboard map shows incident marker

## Design Rules

- keep webhook thin
- keep business logic in services
- persist raw messages before interpretation
- verification is explicit, not implied
- dashboard reads structured events, not raw chats
- do not over-engineer beyond MVP needs