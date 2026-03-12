"""
routes/whatsapp.py - WhatsApp Cloud API webhook endpoints.

Two endpoints:
1. GET  /webhook/whatsapp — Verification endpoint (Meta verifies our webhook)
2. POST /webhook/whatsapp — Receives incoming messages from WhatsApp

Flow:
- POST receives message → parses payload → pushes job to Redis queue
- Worker picks up job → processes asynchronously (no webhook timeout)

WhatsApp Cloud API webhook payload structure:
{
    "object": "whatsapp_business_account",
    "entry": [{
        "changes": [{
            "value": {
                "messages": [...],
                "contacts": [...],
                "metadata": {...}
            }
        }]
    }]
}
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Request, Response, Query, HTTPException
from redis import Redis
from rq import Queue

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["whatsapp"])

# Redis connection and queue for async processing
redis_conn = Redis.from_url(settings.redis_url)
message_queue = Queue("whatsapp_messages", connection=redis_conn)


@router.get("/whatsapp")
async def verify_webhook(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge"),
):
    """
    WhatsApp webhook verification endpoint.

    Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge.
    We must return the challenge value if the token matches.

    This is called once when you register the webhook URL in Meta's dashboard.
    """
    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        logger.info("Webhook verified successfully")
        return Response(content=challenge, media_type="text/plain")

    logger.warning(f"Webhook verification failed: mode={mode}, token={token}")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp")
async def receive_message(request: Request):
    """
    Receive incoming WhatsApp messages.

    Parses the webhook payload, extracts message data, and pushes
    a job to the Redis queue for async processing.

    Returns 200 immediately to prevent webhook timeout.
    WhatsApp will retry if we don't respond within ~20 seconds.
    """
    try:
        body = await request.json()
    except Exception:
        logger.error("Failed to parse webhook body")
        return Response(status_code=200)  # Always return 200 to prevent retries

    # Parse the WhatsApp webhook payload
    messages = _extract_messages(body)

    for msg_data in messages:
        try:
            # Push to Redis queue for async processing
            # This returns immediately — worker handles the rest
            message_queue.enqueue(
                "services.message_processor.process_whatsapp_message",
                msg_data,
                job_timeout="5m",       # Max 5 minutes per message
                result_ttl=3600,         # Keep result for 1 hour
                failure_ttl=86400,       # Keep failed jobs for 24 hours
            )
            logger.info(
                f"Queued message from {msg_data.get('phone', 'unknown')}: "
                f"{msg_data.get('message_type', 'unknown')}"
            )
        except Exception as e:
            logger.error(f"Failed to queue message: {e}", exc_info=True)

    # Always return 200 to WhatsApp — we've queued the job
    return Response(status_code=200)


def _extract_messages(body: Dict[str, Any]) -> list:
    """
    Extract message data from WhatsApp webhook payload.

    Handles text, location, image, audio, and document messages.
    Returns a list of parsed message dicts ready for the queue.
    """
    messages = []

    try:
        # Navigate the nested webhook structure
        entries = body.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                incoming_messages = value.get("messages", [])
                contacts = value.get("contacts", [])

                # Build a phone → name lookup from contacts
                contact_names = {}
                for contact in contacts:
                    wa_id = contact.get("wa_id", "")
                    name = contact.get("profile", {}).get("name", "Unknown")
                    contact_names[wa_id] = name

                for msg in incoming_messages:
                    parsed = _parse_single_message(msg, contact_names, body)
                    if parsed:
                        messages.append(parsed)

    except Exception as e:
        logger.error(f"Error extracting messages from payload: {e}", exc_info=True)

    return messages


def _parse_single_message(
    msg: Dict[str, Any],
    contact_names: Dict[str, str],
    raw_payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Parse a single message from the webhook payload.

    Returns a standardized dict for the message queue.
    """
    msg_id = msg.get("id", "")
    phone = msg.get("from", "")
    msg_type = msg.get("type", "unknown")
    timestamp = msg.get("timestamp", "")

    parsed = {
        "whatsapp_message_id": msg_id,
        "phone": phone,
        "message_type": "unknown",
        "body": None,
        "latitude": None,
        "longitude": None,
        "media_id": None,
        "media_mime_type": None,
        "raw_payload": raw_payload,
        "contact_name": contact_names.get(phone, "Unknown"),
        "timestamp": timestamp,
    }

    # --- Text message ---
    if msg_type == "text":
        parsed["message_type"] = "text"
        parsed["body"] = msg.get("text", {}).get("body", "")

    # --- Location message ---
    elif msg_type == "location":
        parsed["message_type"] = "location"
        location = msg.get("location", {})
        parsed["latitude"] = location.get("latitude")
        parsed["longitude"] = location.get("longitude")
        parsed["body"] = location.get("name", "Location shared")

    # --- Image message ---
    elif msg_type == "image":
        parsed["message_type"] = "image"
        image = msg.get("image", {})
        parsed["media_id"] = image.get("id")
        parsed["media_mime_type"] = image.get("mime_type", "image/jpeg")
        parsed["body"] = image.get("caption", "")

    # --- Audio / Voice note ---
    elif msg_type == "audio":
        parsed["message_type"] = "audio"
        audio = msg.get("audio", {})
        parsed["media_id"] = audio.get("id")
        parsed["media_mime_type"] = audio.get("mime_type", "audio/ogg")

    # --- Document ---
    elif msg_type == "document":
        parsed["message_type"] = "document"
        doc = msg.get("document", {})
        parsed["media_id"] = doc.get("id")
        parsed["media_mime_type"] = doc.get("mime_type", "application/pdf")
        parsed["body"] = doc.get("caption", "")

    else:
        # Unsupported message type — still store it
        parsed["message_type"] = "unknown"
        logger.warning(f"Unsupported message type: {msg_type}")

    return parsed

