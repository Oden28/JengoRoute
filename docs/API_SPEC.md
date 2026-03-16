# API Specification

## External Webhook

### POST `/webhook/whatsapp`
Receives inbound WhatsApp payloads.

Responsibilities:
- receive payload
- validate minimum structure
- enqueue processing job
- return success quickly

Response:
- 200 OK
- body: `{ "status": "received" }`

## Suggested Internal Backend API

### GET `/api/dashboard/summary`
Returns operational summary counts.

Example response:
- total guards active
- verified check-ins today
- unverified events today
- open incidents count

### GET `/api/events`
Returns recent events.

Query params:
- event_type
- status
- user_id
- site_id
- limit

### GET `/api/incidents`
Returns incident list.

Query params:
- severity
- site_id
- open_only

### GET `/api/guards`
Returns guards with latest activity and status.

### GET `/api/map/events`
Returns map-ready event points.

Fields:
- id
- event_type
- latitude
- longitude
- status
- user_name
- occurred_at

### POST `/api/notifications/test`
Optional endpoint to test alert sending.

## Outbound WhatsApp Service Functions

### send_acknowledgement(phone_number, text)
Used after receiving important updates.

### send_missing_location_prompt(phone_number)
Used when a guard sends a check-in without location.

### send_supervisor_alert(phone_number, message)
Used for incidents or failed verification.

## Error Handling Principles

- webhook must not fail due to downstream processing problems
- background job failures should be logged and retryable
- invalid payloads should be logged with safe detail