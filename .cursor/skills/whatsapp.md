---
description: WhatsApp Cloud API integration rules for GuardOps — message parsing, webhook handling, outbound messaging, and media download
globs: backend/**/webhook.py,backend/**/whatsapp.py,backend/**/message_processor.py
alwaysApply: false
---

# GuardOps — WhatsApp Cloud API Integration Rules

## 1. WhatsApp Cloud API Overview

- **Provider:** Meta Platforms WhatsApp Cloud API
- **API Version:** v18.0 (or latest stable — update the version constant in one place)
- **Base URL:** `https://graph.facebook.com/v18.0/`
- **Authentication:** Bearer token sourced from `WHATSAPP_ACCESS_TOKEN` environment variable
- **Phone Number ID:** `WHATSAPP_PHONE_NUMBER_ID` — the business phone number registered with Meta
- All requests to the Graph API must include `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}`

Define constants at the top of `whatsapp.py`:

```python
import os

WHATSAPP_API_VERSION = "v22.0"
WHATSAPP_BASE_URL = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}"
WHATSAPP_ACCESS_TOKEN = os.environ["WHATSAPP_ACCESS_TOKEN"]
WHATSAPP_PHONE_NUMBER_ID = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
WHATSAPP_VERIFY_TOKEN = os.environ["WHATSAPP_VERIFY_TOKEN"]
```

---

## 2. Webhook Verification (GET /webhook/whatsapp)

When Meta configures the webhook, it sends a GET request to verify ownership of the endpoint.

**Query parameters sent by Meta:**
```
hub.mode         = "subscribe"
hub.verify_token = your configured verify token
hub.challenge    = random string that must be echoed back
```

**Handler requirements:**
1. Check `hub.mode == "subscribe"`
2. Check `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN` env var
3. If both match → return `hub.challenge` as plain text with HTTP 200
4. If mismatch → return HTTP 403

```python
from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/webhook/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Handles Meta's webhook verification challenge."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verified successfully.")
        return PlainTextResponse(content=hub_challenge, status_code=200)
    logger.warning(
        "WhatsApp webhook verification failed. "
        f"mode={hub_mode}, token_match={hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN}"
    )
    return PlainTextResponse(content="Forbidden", status_code=403)
```

---

## 3. Inbound Webhook Payload Structure (POST /webhook/whatsapp)

WhatsApp delivers events as a deeply nested JSON object. Always acknowledge receipt with HTTP 200 immediately — never return 5xx.

**Top-level structure:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "27xxxxxxxxx",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "Sipho Dlamini" },
          "wa_id": "27720000001"
        }],
        "messages": [{
          "from": "27720000001",
          "id": "wamid.xxxxx",
          "timestamp": "1710576120",
          "type": "text",
          "text": { "body": "checkin" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Text Message Payload
```json
{
  "type": "text",
  "text": { "body": "checkin" }
}
```

### Location Message Payload
```json
{
  "type": "location",
  "location": {
    "latitude": -33.9804,
    "longitude": 18.4655,
    "name": "Optional location name",
    "address": "Optional address"
  }
}
```

### Image Message Payload
```json
{
  "type": "image",
  "image": {
    "mime_type": "image/jpeg",
    "sha256": "hash_value",
    "id": "MEDIA_ID"
  }
}
```

### Audio Message Payload (voice note)
```json
{
  "type": "audio",
  "audio": {
    "mime_type": "audio/ogg; codecs=opus",
    "sha256": "hash_value",
    "id": "MEDIA_ID"
  }
}
```

> **Important:** WhatsApp also sends **status update webhooks** (delivered, read, failed) that contain a `statuses` array instead of a `messages` array. The POST handler must return 200 without processing these as messages.

---

## 4. Inbound Webhook POST Handler

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@router.post("/webhook/whatsapp")
async def receive_webhook(request: Request):
    """
    Receives all inbound WhatsApp events.
    Always returns 200 — processing failures are handled asynchronously.
    """
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse WhatsApp webhook body: {e}")
        return JSONResponse(content={"status": "ok"}, status_code=200)

    # Validate this is a WhatsApp Business Account event
    if payload.get("object") != "whatsapp_business_account":
        return JSONResponse(content={"status": "ok"}, status_code=200)

    message_data = extract_message_data(payload)
    if message_data is None:
        # Status update or unrecognised payload — acknowledge and ignore
        return JSONResponse(content={"status": "ok"}, status_code=200)

    try:
        await enqueue_message_processing(message_data)
    except Exception as e:
        logger.error(f"Failed to enqueue message for processing: {e}", exc_info=True)
        # Still return 200 — do not ask Meta to retry a poison message

    return JSONResponse(content={"status": "ok"}, status_code=200)
```

---

## 5. Payload Extraction Logic

Write a function to safely extract message data from the nested payload. Handle the status update case explicitly.

```python
def extract_message_data(payload: dict) -> dict | None:
    """
    Extract the first message from a WhatsApp webhook payload.
    Returns None if no message found (e.g. status update callbacks).
    """
    try:
        entry = payload.get("entry", [])
        if not entry:
            return None

        changes = entry[0].get("changes", [])
        if not changes:
            return None

        value = changes[0].get("value", {})

        # Status updates carry 'statuses', not 'messages' — return early
        if "statuses" in value:
            status = value["statuses"][0]
            logger.debug(
                f"WhatsApp status update received: "
                f"id={status.get('id')} status={status.get('status')}"
            )
            return None

        messages = value.get("messages", [])
        if not messages:
            return None

        message = messages[0]
        contacts = value.get("contacts", [])
        sender_name = contacts[0]["profile"]["name"] if contacts else "Unknown"

        return {
            "from": message["from"],
            "message_id": message["id"],
            "timestamp": message["timestamp"],
            "type": message["type"],
            "sender_name": sender_name,
            "message": message,
            "phone_number_id": value.get("metadata", {}).get("phone_number_id"),
        }
    except (KeyError, IndexError) as e:
        logger.warning(f"Failed to extract message from WhatsApp payload: {e}")
        logger.debug(f"Raw payload: {payload}")
        return None
```

---

## 6. Message Type Parsing

Create individual parsers for each supported message type. Keep these pure functions with no side effects.

```python
def parse_text_message(message: dict) -> str:
    """Returns the text body of a text message."""
    return message.get("text", {}).get("body", "").strip()


def parse_location_message(message: dict) -> tuple[float, float] | None:
    """
    Returns (latitude, longitude) from a location message.
    Returns None if coordinates are missing.
    """
    loc = message.get("location", {})
    lat = loc.get("latitude")
    lng = loc.get("longitude")
    if lat is not None and lng is not None:
        return (float(lat), float(lng))
    return None


def parse_media_message(message: dict) -> str | None:
    """
    Returns the media_id for image, audio, video, or document messages.
    The media_id is used in a subsequent API call to retrieve the download URL.
    """
    msg_type = message.get("type")
    if msg_type in ("image", "audio", "video", "document"):
        media_data = message.get(msg_type, {})
        return media_data.get("id")
    return None


def parse_message(message: dict) -> dict:
    """
    Dispatches to the appropriate parser based on message type.
    Returns a normalised dict with type and extracted content.
    """
    msg_type = message.get("type")

    if msg_type == "text":
        return {"type": "text", "body": parse_text_message(message)}

    if msg_type == "location":
        coords = parse_location_message(message)
        return {
            "type": "location",
            "latitude": coords[0] if coords else None,
            "longitude": coords[1] if coords else None,
            "name": message.get("location", {}).get("name"),
            "address": message.get("location", {}).get("address"),
        }

    if msg_type in ("image", "audio", "video", "document"):
        return {
            "type": msg_type,
            "media_id": parse_media_message(message),
            "mime_type": message.get(msg_type, {}).get("mime_type"),
        }

    # Unsupported type (sticker, reaction, etc.) — log and return minimal info
    logger.info(f"Unsupported WhatsApp message type received: {msg_type}")
    return {"type": msg_type, "raw": message}
```

---

## 7. Media Download

Downloading media requires two sequential Graph API calls, then upload to Supabase Storage.

### Step 1 — Retrieve the media URL

```python
import httpx

async def get_media_url(media_id: str) -> dict:
    """
    Fetches metadata and temporary download URL for a media object.
    The URL expires — download immediately.
    """
    url = f"{WHATSAPP_BASE_URL}/{media_id}"
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={"Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}"},
            timeout=15.0,
        )
        response.raise_for_status()
        # Returns: { "url": "...", "mime_type": "image/jpeg", "sha256": "...", "file_size": 123, "id": "..." }
        return response.json()
```

### Step 2 — Download the file bytes

```python
async def download_media(media_url: str) -> bytes:
    """
    Downloads binary content from a WhatsApp media URL.
    Authorization header is required even for the download step.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            media_url,
            headers={"Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}"},
            timeout=60.0,
            follow_redirects=True,
        )
        response.raise_for_status()
        return response.content
```

### Step 3 — Upload to Supabase Storage

```python
from supabase import AsyncClient as SupabaseClient
import mimetypes

async def store_whatsapp_media(
    supabase: SupabaseClient,
    media_id: str,
    bucket: str = "incident-media",
) -> dict | None:
    """
    Downloads a WhatsApp media file and uploads it to Supabase Storage.
    Returns a dict with storage_path and public_url, or None on failure.

    Buckets:
      - incident-media  : photos/audio attached to incident reports
      - message-media   : general media from guard check-ins
    """
    try:
        meta = await get_media_url(media_id)
        media_url = meta["url"]
        mime_type = meta.get("mime_type", "application/octet-stream")

        file_bytes = await download_media(media_url)

        extension = mimetypes.guess_extension(mime_type.split(";")[0].strip()) or ".bin"
        storage_path = f"whatsapp/{media_id}{extension}"

        await supabase.storage.from_(bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": mime_type},
        )

        public_url = supabase.storage.from_(bucket).get_public_url(storage_path)

        return {"storage_path": storage_path, "public_url": public_url, "mime_type": mime_type}

    except Exception as e:
        logger.error(f"Failed to store WhatsApp media {media_id}: {e}", exc_info=True)
        return None  # Do not block event processing on media failure
```

---

## 8. Outbound Messaging

All outbound messages are sent via POST to the Graph API messages endpoint.

```
POST https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
Headers:
  Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
  Content-Type: application/json
```

### Send a Text Message

```python
async def send_text_message(to: str, body: str) -> dict:
    """
    Sends a plain text WhatsApp message.
    'to' must be E.164 without the + prefix, e.g. '27720000001'.
    """
    url = f"{WHATSAPP_BASE_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body},
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            timeout=15.0,
        )
        if response.status_code == 429:
            logger.warning(f"WhatsApp API rate limit hit sending to {to}. Implement backoff.")
        response.raise_for_status()
        return response.json()
```

### Common Outbound Message Templates

```python
# Check-in acknowledgement
CHECK_IN_ACK = "Check-in received. You are verified at {site_name}."

# Location request prompt
LOCATION_REQUEST = (
    "Your check-in was received but no location was attached. "
    "Please share your location to verify your presence."
)

# Incident acknowledgement
INCIDENT_ACK = (
    "Incident report received. A supervisor has been notified. "
    "Reference: {incident_id}"
)

# SOS acknowledgement
SOS_ACK = (
    "EMERGENCY ALERT received. Help is being dispatched to your last known location. "
    "Stay on the line."
)
```

### Example Usage

```python
# After successful check-in
await send_text_message(
    to=normalize_phone_for_api(guard.phone_number),
    body=CHECK_IN_ACK.format(site_name=site.name),
)

# When location is missing from check-in
await send_text_message(
    to=normalize_phone_for_api(guard.phone_number),
    body=LOCATION_REQUEST,
)
```

---

## 9. Phone Number Formatting

WhatsApp uses E.164 format **without** the `+` prefix in all API calls.

```python
import re

def normalize_phone_for_api(phone: str) -> str:
    """
    Strips the leading + from a phone number for WhatsApp API calls.
    Input:  "+27720000001"
    Output: "27720000001"
    """
    return phone.lstrip("+")


def normalize_phone_for_db(phone: str) -> str:
    """
    Ensures phone number is stored with + prefix in the database.
    Input:  "27720000001" or "+27720000001"
    Output: "+27720000001"
    """
    phone = phone.strip()
    if not phone.startswith("+"):
        return f"+{phone}"
    return phone


def phones_match(db_phone: str, wa_phone: str) -> bool:
    """
    Compares a DB-stored phone number (with +) to a WhatsApp sender ID (without +).
    """
    return normalize_phone_for_api(db_phone) == wa_phone.lstrip("+")
```

**South African number conventions:**
- Country code: `27`
- Remove leading `0` when prepending country code: `0720000001` → `27720000001`
- Store in DB: `+27720000001`
- Send in API: `27720000001`

---

## 10. Error Handling

Follow these rules strictly:

| Scenario | Action |
|---|---|
| Webhook payload parse failure | Log error + raw body, return HTTP 200 |
| `extract_message_data` returns None | Return HTTP 200 (status update or unknown event) |
| Downstream processing failure | Job is already queued in Redis — return HTTP 200 |
| Media download failure | Log error, create event without media attachment |
| Graph API 429 (rate limit) | Log warning, implement exponential backoff for retries |
| Graph API 4xx (bad request) | Log full response body for debugging |
| Graph API 5xx (Meta outage) | Retry with backoff, alert if persistent |

**Never return 5xx from the webhook endpoint.** Meta will retry the delivery repeatedly, which can cause duplicate processing.

```python
import asyncio

async def send_with_retry(to: str, body: str, max_attempts: int = 3) -> bool:
    """Sends a WhatsApp message with exponential backoff on rate limit errors."""
    for attempt in range(max_attempts):
        try:
            await send_text_message(to=to, body=body)
            return True
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                wait = 2 ** attempt
                logger.warning(f"Rate limited. Retrying in {wait}s (attempt {attempt + 1})")
                await asyncio.sleep(wait)
            else:
                logger.error(f"Failed to send WhatsApp message to {to}: {e}")
                return False
    logger.error(f"Exhausted retries sending WhatsApp message to {to}")
    return False
```

---

## 11. Security

- **Webhook verification token:** Always validate `hub.verify_token` on GET requests — never skip in any environment.
- **X-Hub-Signature-256 validation:** In production, validate the HMAC signature on every POST request to confirm the payload originated from Meta.

```python
import hashlib
import hmac

def validate_hub_signature(payload_bytes: bytes, signature_header: str) -> bool:
    """
    Validates the X-Hub-Signature-256 header from Meta.
    Must be enabled in production to prevent spoofed webhook calls.
    """
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected_sig = signature_header.removeprefix("sha256=")
    computed_sig = hmac.new(
        key=WHATSAPP_ACCESS_TOKEN.encode(),
        msg=payload_bytes,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(computed_sig, expected_sig)
```

> **Note:** Use `hmac.compare_digest` — not `==` — to prevent timing attacks.

- **Token safety:**
  - Never log `WHATSAPP_ACCESS_TOKEN` — log only the last 4 characters for debugging if needed
  - Never expose the token to frontend clients
  - Rotate the token if it appears in logs or version control
- **Phone number privacy:** Mask phone numbers in logs: `27720***001`

---

## 12. Test Payloads

Use these payloads with a tool such as `curl` or Postman when running the webhook locally (via `ngrok` or similar tunnel).

### Check-in Text Message
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BIZ_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550000000",
          "phone_number_id": "PHONE_ID"
        },
        "contacts": [{
          "profile": { "name": "Sipho Dlamini" },
          "wa_id": "27720000001"
        }],
        "messages": [{
          "from": "27720000001",
          "id": "wamid.test.001",
          "timestamp": "1710576120",
          "type": "text",
          "text": { "body": "checkin" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Location Message
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BIZ_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550000000",
          "phone_number_id": "PHONE_ID"
        },
        "contacts": [{
          "profile": { "name": "Sipho Dlamini" },
          "wa_id": "27720000001"
        }],
        "messages": [{
          "from": "27720000001",
          "id": "wamid.test.002",
          "timestamp": "1710576150",
          "type": "location",
          "location": {
            "latitude": -33.9804,
            "longitude": 18.4655
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Incident Report (Text)
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BIZ_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550000000",
          "phone_number_id": "PHONE_ID"
        },
        "contacts": [{
          "profile": { "name": "Anele Jacobs" },
          "wa_id": "27720000003"
        }],
        "messages": [{
          "from": "27720000003",
          "id": "wamid.test.003",
          "timestamp": "1710633600",
          "type": "text",
          "text": { "body": "incident suspicious person at rear entrance" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Status Update (NOT a message — handler must ignore gracefully)
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BIZ_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550000000",
          "phone_number_id": "PHONE_ID"
        },
        "statuses": [{
          "id": "wamid.test.001",
          "status": "delivered",
          "timestamp": "1710576125",
          "recipient_id": "27720000001"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Image Attachment
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BIZ_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550000000",
          "phone_number_id": "PHONE_ID"
        },
        "contacts": [{
          "profile": { "name": "Sipho Dlamini" },
          "wa_id": "27720000001"
        }],
        "messages": [{
          "from": "27720000001",
          "id": "wamid.test.004",
          "timestamp": "1710576200",
          "type": "image",
          "image": {
            "mime_type": "image/jpeg",
            "sha256": "abc123hashvalue",
            "id": "MEDIA_ID_001"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

---

## 13. Environment Variables Reference

All WhatsApp-related environment variables must be present at startup. Fail fast with a clear error if any are missing.

```python
# Required in .env (local) and deployment secrets (production)
WHATSAPP_ACCESS_TOKEN=      # Long-lived or system user token from Meta Business Suite
WHATSAPP_PHONE_NUMBER_ID=   # Numeric ID for the registered business phone number
WHATSAPP_VERIFY_TOKEN=      # Arbitrary secret you configure in Meta Developer Console

# Optional — set to enable signature validation in production
WHATSAPP_APP_SECRET=        # App secret from Meta Developer Console (for X-Hub-Signature-256)
```

Validate at startup in `config.py`:

```python
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    WHATSAPP_ACCESS_TOKEN: str = Field(..., description="Meta Graph API bearer token")
    WHATSAPP_PHONE_NUMBER_ID: str = Field(..., description="Business phone number ID")
    WHATSAPP_VERIFY_TOKEN: str = Field(..., description="Webhook verification secret")
    WHATSAPP_APP_SECRET: str | None = Field(None, description="App secret for signature validation")

    class Config:
        env_file = ".env"
```
