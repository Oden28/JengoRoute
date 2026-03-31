---
description: Backend rules for JengoRoute FastAPI application — webhook, worker, event engine, verification, and API routes
globs: backend/**/*.py
alwaysApply: false
---

# JengoRoute Backend — Cursor Rules

## Architecture Overview

The backend follows a thin-webhook / async-worker pattern:

```
WhatsApp Cloud API → POST /webhook/whatsapp
                          ↓
                    Redis Queue (python-rq)
                          ↓
                    worker.py → message_processor.process_message()
                                        ↓
                              event_engine.classify()
                                        ↓
                              verification.verify_event()
                                        ↓
                              notification.trigger_alerts()
```

Never perform heavy processing inside a webhook handler. The handler enqueues and returns immediately.

---

## 1. Webhook Handler (`routes/webhook.py`)

The webhook has exactly two responsibilities: validate minimum structure, enqueue to Redis.

```python
from fastapi import APIRouter, Request, HTTPException, Query
from rq import Queue
from redis import Redis
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/webhook/whatsapp")
def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
) -> str:
    """Handle Meta webhook verification challenge."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WEBHOOK_VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")

@router.post("/webhook/whatsapp")
async def receive_webhook(request: Request) -> dict:
    """Receive WhatsApp Cloud API payload, enqueue for processing, return 200 immediately."""
    try:
        payload = await request.json()
    except Exception:
        logger.warning("Received non-JSON webhook payload")
        return {"status": "received"}

    # Validate minimum structure without raising on invalid payloads
    if not isinstance(payload, dict) or "object" not in payload:
        logger.info("Webhook payload missing 'object' field — skipping enqueue")
        return {"status": "received"}

    try:
        redis_conn = Redis.from_url(settings.REDIS_URL)
        q = Queue(connection=redis_conn)
        q.enqueue("services.message_processor.process_message", payload, retry=Retry(max=3))
    except Exception:
        # Never fail the webhook due to downstream problems
        logger.exception("Failed to enqueue webhook payload")

    return {"status": "received"}
```

**Rules:**
- Always return `{"status": "received"}` with HTTP 200, even on parse errors.
- Never log raw payload contents — they may contain PII (phone numbers, message text).
- Log only structural issues (missing fields, wrong type).
- Never `raise` from the POST handler after the response shape is set.
- Webhook verify token must come from `settings.WEBHOOK_VERIFY_TOKEN`, not hardcoded.

---

## 2. Redis Queue + Worker (`worker.py`)

```python
# worker.py — entry point, run as: python worker.py
from redis import Redis
from rq import Worker, Queue
from core.config import settings

if __name__ == "__main__":
    redis_conn = Redis.from_url(settings.REDIS_URL)
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    worker.work()
```

**Rules:**
- Use `python-rq` exclusively for task queuing. Do not use `celery` or `asyncio.create_task` for background jobs.
- Enqueue jobs by module path string (`"services.message_processor.process_message"`), not by direct function reference, to avoid import-time side effects in the webhook process.
- Configure `Retry(max=3)` on enqueue for transient failures.
- Worker runs in a separate process from the FastAPI app.
- Job functions must be importable at the top level of the `backend/` package.

---

## 3. Message Processor (`services/message_processor.py`)

```python
def process_message(payload: dict) -> None:
    """
    Entry point called by RQ worker.
    Normalizes payload, stores raw message, maps to user, calls event engine.
    """
    normalized = normalize_payload(payload)
    if normalized is None:
        return

    raw_id = db.messages.insert_raw(payload, normalized)

    user = db.users.find_by_phone(normalized.sender_phone)
    if user is None:
        logger.info("Unknown sender — message stored, no event created",
                    phone_suffix=normalized.sender_phone[-4:])
        return

    # Group recent messages from same sender within window
    window_msgs = db.messages.fetch_recent_window(
        user_id=user.id,
        window_seconds=settings.MESSAGE_GROUP_WINDOW_SECONDS,  # default 60
    )

    event_engine.handle(normalized, user=user, context_messages=window_msgs)
```

**Normalization rules:**
- Extract `entry[0].changes[0].value.messages[0]` safely — guard every index access.
- `sender_phone`: `message.from_` field.
- `message_type`: `message.type` — one of `text | location | image | audio | interactive | unknown`.
- `text_body`: `message.text.body` if type is `text`, else `None`.
- `location`: `(latitude, longitude)` if type is `location`, else `None`.
- `media_id`: image/audio id if present.
- `timestamp`: convert Unix epoch integer to `datetime` (UTC).
- Return `None` from `normalize_payload` if mandatory fields are absent; log a warning.

**Storage rules:**
- `messages` table insert must be the first DB write — it is the immutable audit record.
- Never update or delete rows in `messages`.
- If user is not found: store message, log with last-4 of phone only, return without event creation.

---

## 4. Event Engine (`services/event_engine.py`)

Classification is evaluated in strict priority order: **incident → checkin → patrol → generic_update**.

```python
def handle(
    msg: NormalizedMessage,
    user: User,
    context_messages: list[NormalizedMessage],
) -> None:
    """Classify message, create event record, trigger verification and notifications."""
    text = _normalize_text(msg.text_body or "")
    event_type, severity = classify(text, msg)
    event_id = db.events.create(EventCreate(
        user_id=user.id,
        event_type=event_type,
        raw_message_id=msg.raw_id,
        occurred_at=msg.timestamp,
    ))
    if event_type == "incident":
        db.incidents.create(IncidentCreate(event_id=event_id, severity=severity, ...))
    verification.verify_event(event_id, msg, user)
    notification.trigger_alerts(event_id, event_type, severity)

def _normalize_text(text: str) -> str:
    """Trim whitespace, lowercase, collapse duplicate spaces."""
    import re
    return re.sub(r"\s+", " ", text.strip().lower())
```

**Classification keywords:**

| Priority | Event Type       | Keywords |
|----------|-----------------|----------|
| 1        | `incident`       | incident, break-in, suspicious person, gate damaged, alarm triggered, break, damage, forced entry, armed, weapon, attack, fire |
| 2        | `checkin`        | checkin, check in, check-in, checked in, arrived, on site |
| 3        | `patrol`         | patrol done, patrol complete, sector complete, patrol done sector |
| 4        | `generic_update` | (fallback — anything unmatched) |

**Incident severity logic:**
```python
CRITICAL_WORDS = {"armed", "weapon", "attack", "fire"}
HIGH_WORDS = {"break", "damage", "forced entry"}

def _incident_severity(text: str) -> str:
    words = set(text.split())
    if words & CRITICAL_WORDS:
        return "critical"
    if any(phrase in text for phrase in HIGH_WORDS):
        return "high"
    return "medium"
```

**Rules:**
- Never short-circuit classification — always evaluate all priorities in order.
- Keyword matching uses normalized text (lowercase, collapsed spaces).
- For `checkin`: location is strongly preferred; emit a `send_missing_location_prompt` if absent.
- For `patrol`: location and description are optional.
- For incidents with severity `high` or `critical`: trigger supervisor alert synchronously before returning.

---

## 5. Verification Layer (`services/verification.py`)

This service is **fully isolated** from event creation logic. It only reads event data and writes a `VerificationResult`.

```python
def verify_event(event_id: str, msg: NormalizedMessage, user: User) -> VerificationResult:
    """
    Compute verification status for an event.
    Never raises — returns pending_review on any unexpected error.
    """
    assignment = db.guard_assignments.find_active(user_id=user.id)

    location_status = _check_location(msg.location, assignment)
    time_status = _check_time(msg.timestamp, assignment)
    photo_status = _check_photo(msg.media_id, assignment)

    overall = _compute_overall(location_status, time_status, photo_status, assignment)

    result = VerificationResultCreate(
        event_id=event_id,
        location_status=location_status,
        time_status=time_status,
        photo_status=photo_status,
        overall_status=overall,
    )
    return db.verification_results.insert(result)
```

**Status values:**

| Field              | Values |
|--------------------|--------|
| `location_status`  | `match` \| `mismatch` \| `missing` |
| `time_status`      | `within_window` \| `outside_window` \| `unknown` |
| `photo_status`     | `provided` \| `missing` \| `not_required` |
| `overall_status`   | `verified` \| `unverified` \| `pending_review` |

**Overall status logic:**
```python
def _compute_overall(location_status, time_status, photo_status, assignment) -> str:
    if assignment is None:
        return "pending_review"
    if location_status == "missing":
        return "pending_review"
    if location_status == "mismatch":
        return "unverified"
    if location_status == "match" and time_status == "within_window":
        return "verified"
    return "pending_review"
```

**Location check — Haversine distance:**
```python
from math import radians, sin, cos, sqrt, atan2

def _haversine_meters(lat1, lon1, lat2, lon2) -> float:
    R = 6_371_000  # Earth radius in metres
    φ1, φ2 = radians(lat1), radians(lat2)
    dφ = radians(lat2 - lat1)
    dλ = radians(lon2 - lon1)
    a = sin(dφ/2)**2 + cos(φ1)*cos(φ2)*sin(dλ/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))
```

- Use `assignment.allowed_radius_meters` for the threshold (default `200`).
- If `msg.location` is `None`: `location_status = "missing"`.
- If assignment has no `site_latitude`/`site_longitude`: `location_status = "missing"`.

---

## 6. Dashboard API Routes (`routes/api.py`)

All routes are read-only queries against the DB. Keep handlers thin — delegate all DB logic to `db/` functions.

```python
# GET /api/dashboard/summary
@router.get("/api/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary() -> DashboardSummary:
    return db.dashboard.get_summary()

# GET /api/events
@router.get("/api/events")
def list_events(
    event_type: str | None = None,
    status: str | None = None,
    user_id: str | None = None,
    site_id: str | None = None,
    limit: int = 50,
) -> list[dict]: ...

# GET /api/incidents
@router.get("/api/incidents")
def list_incidents(
    severity: str | None = None,
    site_id: str | None = None,
    open_only: bool = False,
) -> list[dict]: ...

# GET /api/guards
@router.get("/api/guards")
def list_guards() -> list[GuardStatus]: ...

# GET /api/map/events
@router.get("/api/map/events")
def map_events() -> list[MapEvent]: ...

# POST /api/notifications/test
@router.post("/api/notifications/test")
def test_notification(phone_number: str, message: str) -> dict:
    whatsapp.send_supervisor_alert(phone_number, message)
    return {"status": "sent"}
```

**DashboardSummary fields:** `total_guards_active`, `verified_checkins_today`, `unverified_events_today`, `open_incidents_count`.

**MapEvent fields:** `id`, `event_type`, `latitude`, `longitude`, `status`, `user_name`, `occurred_at`.

**Rules:**
- Default `limit=50` on list endpoints; cap at `200` to prevent large result sets.
- Never expose raw DB row dicts — always serialize through Pydantic response models.
- Use `response_model=` on all `@router.get` / `@router.post` decorators.

---

## 7. Outbound WhatsApp Service (`services/whatsapp.py`)

```python
import httpx
from core.config import settings

GRAPH_URL = "https://graph.facebook.com/v18.0/{phone_number_id}/messages"

def _post(payload: dict) -> None:
    url = GRAPH_URL.format(phone_number_id=settings.WHATSAPP_PHONE_NUMBER_ID)
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"}
    with httpx.Client() as client:
        resp = client.post(url, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()

def send_acknowledgement(phone_number: str, text: str) -> None:
    """Send a confirmation reply to a guard after receiving their update."""
    _post({"messaging_product": "whatsapp", "to": phone_number,
           "type": "text", "text": {"body": text}})

def send_missing_location_prompt(phone_number: str) -> None:
    """Prompt guard to share location when check-in lacks coordinates."""
    send_acknowledgement(phone_number,
        "Please share your current location so we can verify your check-in.")

def send_supervisor_alert(phone_number: str, message: str) -> None:
    """Send an incident or verification-failure alert to a supervisor."""
    _post({"messaging_product": "whatsapp", "to": phone_number,
           "type": "text", "text": {"body": f"[ALERT] {message}"}})
```

**Rules:**
- Read `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` exclusively from `settings`.
- Never hardcode tokens or phone number IDs.
- Wrap `_post` calls in try/except in callers — a failed outbound message must not break event processing.

---

## 8. Notification Service (`services/notification.py`)

```python
def trigger_alerts(event_id: str, event_type: str, severity: str | None) -> None:
    """
    Evaluate whether alerts should fire for this event.
    Looks up supervisors for the relevant site, sends WhatsApp alerts.
    """
    if event_type == "incident" and severity in ("high", "critical"):
        _alert_supervisors_for_event(event_id, severity)

    elif event_type == "checkin":
        result = db.verification_results.find_by_event(event_id)
        if result and result.overall_status == "unverified":
            _alert_supervisors_for_event(event_id, reason="unverified_checkin")
        if result and result.location_status == "missing":
            msg = db.messages.find_by_event(event_id)
            if msg:
                whatsapp.send_missing_location_prompt(msg.sender_phone)

def _alert_supervisors_for_event(event_id: str, **kwargs) -> None:
    site_id = db.events.get_site_id(event_id)
    supervisors = db.users.find_supervisors_for_site(site_id)
    for sup in supervisors:
        try:
            whatsapp.send_supervisor_alert(sup.phone_number, _format_alert(event_id, **kwargs))
        except Exception:
            logger.exception("Failed to send supervisor alert", supervisor_id=sup.id)
```

**Trigger conditions:**
- Incident created with severity `high` or `critical` → alert supervisors immediately.
- Check-in verification result is `unverified` → alert supervisors.
- Check-in has no location and location is required → prompt guard.
- Any event marked `critical` → alert supervisors.

---

## 9. Database Access (`db/`)

```python
# db/client.py
from supabase import create_client, Client
from core.config import settings
import functools

@functools.lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
```

**Rules:**
- Initialize the Supabase client once via `lru_cache`. Never create it per-request.
- All DB interactions must live in `db/` modules (e.g., `db/messages.py`, `db/events.py`, `db/users.py`).
- No inline Supabase queries in `services/` or `routes/`.
- Wrap every query in try/except; log errors with context; re-raise only if the caller must handle failure.
- Use `SUPABASE_SERVICE_ROLE_KEY` (server-side only) — never expose to frontend or logs.

---

## 10. Pydantic Models (`models/`)

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

class NormalizedMessage(BaseModel):
    raw_id: str
    sender_phone: str
    message_type: Literal["text", "location", "image", "audio", "interactive", "unknown"]
    text_body: str | None = None
    location: tuple[float, float] | None = None  # (latitude, longitude)
    media_id: str | None = None
    timestamp: datetime

class EventCreate(BaseModel):
    user_id: str
    event_type: Literal["checkin", "patrol", "incident", "generic_update"]
    raw_message_id: str
    occurred_at: datetime

class IncidentCreate(BaseModel):
    event_id: str
    severity: Literal["low", "medium", "high", "critical"]
    description: str | None = None

class VerificationResultCreate(BaseModel):
    event_id: str
    location_status: Literal["match", "mismatch", "missing"]
    time_status: Literal["within_window", "outside_window", "unknown"]
    photo_status: Literal["provided", "missing", "not_required"]
    overall_status: Literal["verified", "unverified", "pending_review"]

class DashboardSummary(BaseModel):
    total_guards_active: int
    verified_checkins_today: int
    unverified_events_today: int
    open_incidents_count: int

class GuardStatus(BaseModel):
    user_id: str
    name: str
    assigned_site: str | None
    last_event_type: str | None
    last_event_at: datetime | None
    last_latitude: float | None
    last_longitude: float | None
    status_indicator: Literal["active", "inactive", "overdue"]

class MapEvent(BaseModel):
    id: str
    event_type: str
    latitude: float
    longitude: float
    status: str
    user_name: str
    occurred_at: datetime
```

**Rules:**
- Use `Literal` types for all enum-like fields — no bare `str` for fields with a fixed value set.
- Never use `Optional[X]` — prefer `X | None`.
- Models in `models/` are pure data structures: no DB calls, no business logic.
- Keep model field names consistent with DB column names for easy mapping.

---

## 11. Code Style

**Imports** — always in this order, separated by blank lines:
```python
# 1. stdlib
import logging
import re
from datetime import datetime

# 2. third-party
from fastapi import APIRouter
from pydantic import BaseModel
import httpx

# 3. local
from core.config import settings
from models.events import EventCreate
import db.events as db_events
```

**Type hints** — required on all function signatures:
```python
# CORRECT
def classify(text: str, msg: NormalizedMessage) -> tuple[str, str | None]: ...

# WRONG
def classify(text, msg): ...
```

**Docstrings** — required on all service-layer functions:
```python
def verify_event(event_id: str, msg: NormalizedMessage, user: User) -> VerificationResult:
    """
    Compute verification status for an event against guard assignment constraints.
    Does not raise; returns pending_review on unexpected errors.
    """
```

**Error handling:**
- Use `logger.exception(...)` (not `logger.error`) when catching exceptions — this captures the traceback.
- Include structured context in log calls: `logger.info("...", user_id=user.id, event_id=event_id)`.
- Never log full phone numbers — use last-4 digits only: `phone[-4:]`.
- Do not use bare `except:` — always catch `Exception` at minimum.

**Forbidden patterns:**
- No wildcard imports: `from module import *`
- No hardcoded secrets, tokens, or credentials — all from `settings` / environment.
- No business logic inside route handlers — delegate to service functions.
- No Supabase queries outside `db/` modules.
- No synchronous HTTP calls inside async FastAPI route handlers — use `httpx.AsyncClient` if needed in routes.
