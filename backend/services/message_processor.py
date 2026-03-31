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
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from models.database import supabase
from services.event_engine import event_engine
from services.media_service import media_service
from services.notification_service import notification_service

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

        # Step 2b: Handle template-button driven flows before creating events
        body = (message_data.get("body") or "").strip().lower()
        if msg_type == "button" and body in ("share location", "share location.", "quick reply"):
            from services.whatsapp_client import whatsapp_client
            await whatsapp_client.send_location_request(to=phone)
            _store_flow_marker(
                user_id=user["id"],
                phone=phone,
                marker="awaiting_location",
            )
            supabase.table("messages").update({"processed": True}).eq("id", message_record["id"]).execute()
            logger.info(f"Sent location request to {phone} (Share Location button)")
            return
        if msg_type == "button" and body in (
            "report incident",
            "report incidents",
            "report incident.",
            "report incidents.",
        ):
            from services.whatsapp_client import whatsapp_client
            # Start guided incident collection flow instead of creating empty incident event.
            await whatsapp_client.send_guard_template(
                to=phone,
                template_name="incident_start",
                language_code="en_US",
                body_parameters=None,
            )
            _store_flow_marker(
                user_id=user["id"],
                phone=phone,
                marker="awaiting_incident_details",
            )
            supabase.table("messages").update({"processed": True}).eq("id", message_record["id"]).execute()
            logger.info(f"Started incident flow for {phone} (Report Incident button)")
            return

        # Normalize template button labels into canonical event phrases.
        # This keeps template UX flexible while event detection stays deterministic.
        normalized_text = _normalize_guard_button_to_text(msg_type=msg_type, body=body)
        if normalized_text:
            message_data["body"] = normalized_text
            body = normalized_text

        # Context-aware coercion:
        # If guard sends free text while we're waiting for incident details,
        # treat it as incident narrative instead of defaulting to check-in.
        if msg_type == "text" and _is_freeform_text(body):
            pending_marker = _get_latest_open_marker(phone=phone, marker_prefix="awaiting_incident_details")
            if pending_marker:
                message_data["body"] = f"incident {message_data.get('body', '').strip()}"
                logger.info("Applied incident context for %s based on recent flow marker", phone)

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

        # Handle incident flow when awaiting location
        if msg_type == "text":
            pending = _get_latest_open_marker(phone=phone, marker_prefix="awaiting_incident_location")
            if pending:
                if _is_skip_location(body):
                    await _complete_incident_without_location(user=user, phone=phone, marker_row=pending)
                    supabase.table("messages").update({"processed": True}).eq("id", message_record["id"]).execute()
                    logger.info("Incident completed without location (guard skipped) for %s", phone)
                    return
                # Non-skip text: remind them to share location or skip
                from services.whatsapp_client import whatsapp_client
                await whatsapp_client.send_text_message(
                    to=phone,
                    body="📍 Please share your location for the incident, or reply *skip* if you can't.",
                )
                supabase.table("messages").update({"processed": True}).eq("id", message_record["id"]).execute()
                return

        # Context-aware location handling:
        # 1. If in incident flow awaiting location → attach to incident, notify supervisors, confirm
        # 2. Else if open unverified check-in/patrol → attach to that event
        if msg_type == "location":
            updated = await _attach_location_to_open_incident(
                user=user,
                phone=phone,
                latitude=message_data.get("latitude"),
                longitude=message_data.get("longitude"),
            )
            if updated:
                supabase.table("messages").update({"processed": True}).eq("id", message_record["id"]).execute()
                logger.info("Location linked to incident %s for %s", updated.get("incident_id"), phone)
                return

            updated_event = await _attach_location_to_open_event(
                user=user,
                latitude=message_data.get("latitude"),
                longitude=message_data.get("longitude"),
            )
            if updated_event:
                from services.whatsapp_client import whatsapp_client
                await whatsapp_client.send_location_thanks(to=phone)
                supabase.table("messages").update(
                    {"processed": True}
                ).eq("id", message_record["id"]).execute()
                logger.info(
                    "Location message linked to existing event %s (%s)",
                    updated_event.get("id"),
                    updated_event.get("event_type"),
                )
                return

        # Step 4: Send to Event Engine for detection + verification
        event = await event_engine.process_event(
            user=user,
            text=message_data.get("body"),
            latitude=message_data.get("latitude"),
            longitude=message_data.get("longitude"),
            media_urls=media_urls,
        )

        # Save lightweight conversation-state markers for follow-up flows.
        if event.get("event_type") in ("checkin", "patrol") and (
            message_data.get("latitude") is None or message_data.get("longitude") is None
        ):
            _store_flow_marker(
                user_id=user["id"],
                phone=phone,
                marker=f"awaiting_location:{event.get('id')}",
            )
        # Incident "incident_recorded" marker is stored when location is received or guard skips

        # Confirm location capture with a lightweight template message.
        if msg_type == "location":
            from services.whatsapp_client import whatsapp_client
            await whatsapp_client.send_location_thanks(to=phone)

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


def _normalize_guard_button_to_text(msg_type: str, body: str) -> Optional[str]:
    """Map known template button labels to canonical text used by the event engine."""
    if msg_type != "button":
        return None

    button_map = {
        # missed_checkin
        "check-in now": "checkin",
        "off duty": "checkout off duty",
        # patrol_prompt
        "patrol complete": "patrol complete",
        "patrol incomplete": "incident patrol incomplete",
        # incident_start
        "armed / weapon": "incident armed / weapon",
        "break-in": "incident break-in",
        "suspicious person": "incident suspicious person",
        # shift_start
        "start shift": "checkin shift start",
        "cannot start": "incident cannot start shift",
        # shift_end
        "end shift": "checkout end shift",
        "handover": "checkout handover",
        "overtime": "checkout overtime",
    }
    return button_map.get(body)


def _is_skip_location(text: str) -> bool:
    """True when guard indicates they cannot or will not share location."""
    if not text:
        return False
    t = text.strip().lower()
    skip_phrases = ("skip", "no", "cant", "can't", "cannot", "unable", "n/a", "na", "no location")
    return t in skip_phrases or any(phrase in t for phrase in skip_phrases)


def _is_freeform_text(text: str) -> bool:
    """True when text doesn't already look like a command keyword."""
    if not text:
        return False
    t = text.strip().lower()
    known_prefixes = (
        "checkin", "check in", "check-in",
        "checkout", "check out", "check-out",
        "incident", "patrol", "sos", "help", "alert",
        "armed", "weapon", "break-in", "break in", "suspicious",
    )
    return not any(t.startswith(prefix) for prefix in known_prefixes)


def _store_flow_marker(user_id: str, phone: str, marker: str) -> None:
    """
    Persist conversational flow state in messages table.
    Keeps the system stateless in memory but stateful across process restarts.
    """
    supabase.table("messages").insert(
        {
            "whatsapp_message_id": f"flow-{uuid4()}",
            "phone": phone,
            "direction": "outgoing",
            "message_type": "flow_marker",
            "body": marker,
            "user_id": user_id,
            "processed": True,
        }
    ).execute()


def _get_latest_open_marker(phone: str, marker_prefix: str, within_minutes: int = 120) -> Optional[Dict[str, Any]]:
    """Read the latest recent flow marker for a phone number."""
    since = (datetime.now(timezone.utc) - timedelta(minutes=within_minutes)).isoformat()
    result = (
        supabase.table("messages")
        .select("*")
        .eq("phone", phone)
        .eq("direction", "outgoing")
        .eq("message_type", "flow_marker")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    )
    terminal_markers = {
        "awaiting_incident_details": ("incident_recorded",),
        "awaiting_incident_location": ("incident_recorded",),
    }
    for row in (result.data or []):
        marker = (row.get("body") or "").strip().lower()
        blockers = terminal_markers.get(marker_prefix, ())
        if marker in blockers:
            return None
        if marker.startswith(marker_prefix):
            return row
    return None


async def _attach_location_to_open_event(
    user: Dict[str, Any],
    latitude: Optional[float],
    longitude: Optional[float],
) -> Optional[Dict[str, Any]]:
    """Attach location to the most recent unverified checkin/patrol for this guard."""
    if latitude is None or longitude is None:
        return None

    recent = (
        supabase.table("events")
        .select("*")
        .eq("user_id", user["id"])
        .in_("event_type", ["checkin", "patrol"])
        .gte("created_at", (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat())
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    target = None
    for ev in (recent.data or []):
        if ev.get("verification_status") != "verified":
            target = ev
            break
    if not target:
        return None

    loc_verified, loc_note = event_engine.verify_location(
        latitude,
        longitude,
        user.get("expected_latitude"),
        user.get("expected_longitude"),
    )
    created_at = target.get("created_at")
    event_time = None
    if isinstance(created_at, str):
        # Handles "Z" and offset formats
        event_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    time_verified, time_note = event_engine.verify_time(event_time=event_time)
    verification_status = "verified" if (loc_verified and time_verified) else "unverified"
    verification_notes = f"{loc_note} | {time_note} | {target.get('verification_notes', '')}"

    updated = (
        supabase.table("events")
        .update(
            {
                "latitude": latitude,
                "longitude": longitude,
                "verification_status": verification_status,
                "verification_notes": verification_notes,
                "location_verified": loc_verified,
                "time_verified": time_verified,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", target["id"])
        .execute()
    )
    event = updated.data[0] if updated.data else None
    if not event:
        return None

    # Send updated verification response and supervisor escalation if still unverified.
    from services.whatsapp_client import whatsapp_client

    await whatsapp_client.send_verification_result(
        to=user["phone"],
        event_type=event.get("event_type", "checkin"),
        verified=(verification_status == "verified"),
        notes=verification_notes,
    )
    if verification_status == "unverified":
        await notification_service.notify_supervisors(
            company_id=user["company_id"],
            guard_name=user["name"],
            event_type=event.get("event_type", "checkin"),
            description=event.get("description", ""),
            latitude=event.get("latitude"),
            longitude=event.get("longitude"),
        )

    return event


async def _attach_location_to_open_incident(
    user: Dict[str, Any],
    phone: str,
    latitude: Optional[float],
    longitude: Optional[float],
) -> Optional[Dict[str, Any]]:
    """
    Attach location to an incident awaiting location (marker: awaiting_incident_location:{event_id}).
    Updates event + incident, notifies supervisors, sends confirmation to guard.
    """
    if latitude is None or longitude is None:
        return None

    pending = _get_latest_open_marker(phone=phone, marker_prefix="awaiting_incident_location")
    if not pending:
        return None

    marker_body = (pending.get("body") or "").strip()
    if ":" not in marker_body:
        return None
    event_id = marker_body.split(":", 1)[1].strip()
    if not event_id:
        return None

    # Update event with location
    supabase.table("events").update(
        {
            "latitude": latitude,
            "longitude": longitude,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", event_id).execute()

    # Get incident by event_id and update it
    incident_result = (
        supabase.table("incidents")
        .select("*")
        .eq("event_id", event_id)
        .limit(1)
        .execute()
    )
    if not incident_result.data:
        return None

    incident = incident_result.data[0]
    supabase.table("incidents").update(
        {
            "latitude": latitude,
            "longitude": longitude,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", incident["id"]).execute()

    # Notify supervisors (now we have full incident with location)
    await notification_service.notify_supervisors(
        company_id=user["company_id"],
        guard_name=user["name"],
        event_type="incident",
        description=incident.get("description", ""),
        latitude=latitude,
        longitude=longitude,
    )

    from services.whatsapp_client import whatsapp_client
    await whatsapp_client.send_incident_confirmation(to=phone)

    _store_flow_marker(user_id=user["id"], phone=phone, marker="incident_recorded")

    return {"event_id": event_id, "incident_id": incident["id"]}


async def _complete_incident_without_location(
    user: Dict[str, Any], phone: str, marker_row: Dict[str, Any]
) -> None:
    """
    Complete incident flow when guard skips location (sends "skip", "no", etc.).
    Notify supervisors with whatever we have; send confirmation to guard.
    """
    marker_body = (marker_row.get("body") or "").strip()
    if ":" not in marker_body:
        return
    event_id = marker_body.split(":", 1)[1].strip()
    if not event_id:
        return

    incident_result = (
        supabase.table("incidents")
        .select("*")
        .eq("event_id", event_id)
        .limit(1)
        .execute()
    )
    if not incident_result.data:
        return

    incident = incident_result.data[0]

    await notification_service.notify_supervisors(
        company_id=user["company_id"],
        guard_name=user["name"],
        event_type="incident",
        description=incident.get("description", ""),
        latitude=None,
        longitude=None,
    )

    from services.whatsapp_client import whatsapp_client
    await whatsapp_client.send_incident_confirmation(to=phone)

    _store_flow_marker(user_id=user["id"], phone=phone, marker="incident_recorded")

