"""
services/message_processor.py - Async message processing worker.

This is the Redis RQ job handler. It:
1. Receives raw WhatsApp message data from the Redis queue
2. Identifies the user (guard) by phone number
3. Stores the raw message in the database (audit trail)
4. Downloads and uploads any media attachments
5. Sends the processed data to the Event Engine for verification

This runs as a background worker, separate from the FastAPI server,
preventing webhook timeouts and enabling scalable async processing.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

from models.database import supabase
from services.event_engine import event_engine
from services.media_service import media_service

logger = logging.getLogger(__name__)


async def process_whatsapp_message(message_data: Dict[str, Any]):
    """
    Main job handler for processing a WhatsApp message.

    Called by the RQ worker when a job is dequeued from Redis.

    Args:
        message_data: Parsed message data dict with keys:
            - whatsapp_message_id: str
            - phone: str (sender's number)
            - message_type: str (text/location/image/audio)
            - body: Optional[str] (text content)
            - latitude: Optional[float]
            - longitude: Optional[float]
            - media_id: Optional[str]
            - media_mime_type: Optional[str]
            - raw_payload: dict (full webhook payload)
    """
    phone = message_data.get("phone", "")
    msg_type = message_data.get("message_type", "text")
    logger.info(f"Processing {msg_type} message from {phone}")

    try:
        # Step 1: Identify user by phone number
        user = await _identify_user(phone)
        if not user:
            logger.warning(f"Unknown phone number: {phone}. Sending registration prompt.")
            await _send_unknown_user_response(phone)
            return

        # Step 2: Store raw message in database (audit trail)
        message_record = await _store_raw_message(message_data, user)

        # Step 3: Process media attachments (if any)
        media_urls = []
        if message_data.get("media_id"):
            url = await media_service.process_media(
                media_id=message_data["media_id"],
                mime_type=message_data.get("media_mime_type", "application/octet-stream"),
                company_id=user["company_id"],
                event_type=msg_type,
            )
            if url:
                media_urls.append(url)
                # Update message record with media URL
                supabase.table("messages").update(
                    {"media_url": url}
                ).eq("id", message_record["id"]).execute()

        # Step 4: Send to Event Engine for detection + verification
        event = await event_engine.process_event(
            user=user,
            text=message_data.get("body"),
            latitude=message_data.get("latitude"),
            longitude=message_data.get("longitude"),
            media_urls=media_urls,
        )

        # Step 5: Mark message as processed
        supabase.table("messages").update(
            {"processed": True}
        ).eq("id", message_record["id"]).execute()

        logger.info(
            f"Message processed successfully: {message_record['id']} → "
            f"Event {event.get('id', 'unknown')} ({event.get('event_type', 'unknown')})"
        )

    except Exception as e:
        logger.error(f"Failed to process message from {phone}: {e}", exc_info=True)
        raise  # Re-raise so RQ marks the job as failed


async def _identify_user(phone: str) -> Optional[Dict[str, Any]]:
    """
    Look up a user by their WhatsApp phone number.

    Returns:
        User dict if found, None otherwise
    """
    # Normalize phone number (remove spaces, ensure + prefix)
    phone = phone.strip().replace(" ", "")
    if not phone.startswith("+"):
        phone = f"+{phone}"

    result = (
        supabase.table("users")
        .select("*")
        .eq("phone", phone)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


async def _store_raw_message(
    message_data: Dict[str, Any], user: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Store the raw incoming message in the messages table.

    This creates an audit trail of all WhatsApp interactions.
    """
    record = {
        "whatsapp_message_id": message_data.get("whatsapp_message_id", ""),
        "phone": message_data.get("phone", ""),
        "direction": "incoming",
        "message_type": message_data.get("message_type", "text"),
        "body": message_data.get("body"),
        "latitude": message_data.get("latitude"),
        "longitude": message_data.get("longitude"),
        "media_id": message_data.get("media_id"),
        "media_mime_type": message_data.get("media_mime_type"),
        "raw_payload": message_data.get("raw_payload"),
        "user_id": user["id"],
        "processed": False,
    }

    result = supabase.table("messages").insert(record).execute()
    if result.data:
        logger.info(f"Raw message stored: {result.data[0]['id']}")
        return result.data[0]

    logger.error("Failed to store raw message")
    return record


async def _send_unknown_user_response(phone: str):
    """
    Send a response to an unregistered phone number.
    Tells them to contact their security company admin.
    """
    from services.whatsapp_client import whatsapp_client

    await whatsapp_client.send_text_message(
        to=phone,
        body=(
            "👋 Welcome to JengoRoute Security.\n\n"
            "Your phone number is not registered in our system. "
            "Please contact your security company administrator "
            "to set up your account.\n\n"
            "Once registered, you can:\n"
            "• Send *checkin* to check in at your post\n"
            "• Send *patrol done [sector]* to log patrols\n"
            "• Send *incident [description]* to report incidents\n"
            "• Share your 📍 location for verification"
        ),
    )

