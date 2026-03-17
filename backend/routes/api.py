"""
routes/api.py - REST API endpoints for the Next.js dashboard.

Provides data endpoints for:
- Events (with filtering)
- Incidents
- Guards (users)
- Activity feed
- Dashboard stats

These endpoints are consumed by the Next.js frontend.
"""

import logging
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, HTTPException, Body
from pydantic import BaseModel

from models.database import supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["dashboard"])


def _raise_whatsapp_error_if_any(result: dict) -> None:
    """Normalize WhatsApp API errors into HTTP 502 responses."""
    if not result.get("error"):
        return
    detail = result["error"]
    if isinstance(detail, dict):
        detail = detail.get("message", str(detail))
    detail = str(detail)
    if "132001" in detail or "translation" in detail.lower():
        detail += ' Try "language_code": "en_US" or "en" in the request body to match the template language in Meta.'
    raise HTTPException(status_code=502, detail=detail)


@router.get("/events")
async def get_events(
    company_id: Optional[str] = None,
    event_type: Optional[str] = None,
    verification_status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """
    Get events with optional filtering.
    Used by the dashboard live feed and map.
    """
    query = supabase.table("events").select(
        "*, users(name, phone, role)"
    ).order("created_at", desc=True).limit(limit).offset(offset)

    if company_id:
        query = query.eq("company_id", company_id)
    if event_type:
        query = query.eq("event_type", event_type)
    if verification_status:
        query = query.eq("verification_status", verification_status)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/events/{event_id}")
async def get_event(event_id: str):
    """Get a single event by ID."""
    result = (
        supabase.table("events")
        .select("*, users(name, phone, role)")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return result.data[0]


@router.get("/incidents")
async def get_incidents(
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """
    Get incidents with optional filtering.
    Used by the incidents page.
    """
    query = supabase.table("incidents").select(
        "*, users!incidents_user_id_fkey(name, phone), events!incidents_event_id_fkey(event_type, verification_status)"
    ).order("created_at", desc=True).limit(limit).offset(offset)

    if company_id:
        query = query.eq("company_id", company_id)
    if status:
        query = query.eq("status", status)
    if severity:
        query = query.eq("severity", severity)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """Get a single incident by ID."""
    result = (
        supabase.table("incidents")
        .select("*, users!incidents_user_id_fkey(name, phone), events!incidents_event_id_fkey(*)")
        .eq("id", incident_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result.data[0]


@router.patch("/incidents/{incident_id}")
async def update_incident(incident_id: str, updates: dict):
    """
    Update an incident (e.g., change status, assign supervisor, add resolution notes).
    """
    allowed_fields = {"status", "severity", "assigned_to", "resolution_notes"}
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}

    if not filtered:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    # If resolving, set resolved_at timestamp
    if filtered.get("status") in ("resolved", "closed"):
        filtered["resolved_at"] = datetime.now(timezone.utc).isoformat()

    filtered["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("incidents")
        .update(filtered)
        .eq("id", incident_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result.data[0]


@router.get("/guards")
async def get_guards(
    company_id: Optional[str] = None,
    role: Optional[str] = None,
):
    """
    Get all guards/users with their latest activity.
    Used by the guards page.
    """
    query = supabase.table("users").select("*").eq("is_active", True).order("name")

    if company_id:
        query = query.eq("company_id", company_id)
    if role:
        query = query.eq("role", role)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/guards/{guard_id}")
async def get_guard(guard_id: str):
    """Get a single guard with their recent events."""
    user_result = (
        supabase.table("users").select("*").eq("id", guard_id).limit(1).execute()
    )
    if not user_result.data:
        raise HTTPException(status_code=404, detail="Guard not found")

    events_result = (
        supabase.table("events")
        .select("*")
        .eq("user_id", guard_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    return {
        "guard": user_result.data[0],
        "recent_events": events_result.data,
    }


@router.get("/activity")
async def get_activity_feed(
    company_id: Optional[str] = None,
    limit: int = Query(100, le=500),
):
    """
    Get real-time activity feed combining events, incidents, and messages.
    Used by the activity page.
    """
    # Get recent events
    events_query = (
        supabase.table("events")
        .select("*, users(name, phone, role)")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if company_id:
        events_query = events_query.eq("company_id", company_id)

    events_result = events_query.execute()

    # Transform into activity feed items
    feed = []
    for event in (events_result.data or []):
        user_info = event.get("users", {}) or {}
        feed.append({
            "id": event["id"],
            "type": "event",
            "event_type": event["event_type"],
            "guard_name": user_info.get("name", "Unknown"),
            "description": event.get("description", ""),
            "verification_status": event["verification_status"],
            "latitude": event.get("latitude"),
            "longitude": event.get("longitude"),
            "media_urls": event.get("media_urls", []),
            "created_at": event["created_at"],
        })

    # Sort by timestamp (most recent first)
    feed.sort(key=lambda x: x["created_at"], reverse=True)

    return {"data": feed[:limit], "count": len(feed)}


@router.get("/stats")
async def get_dashboard_stats(company_id: Optional[str] = None):
    """
    Get summary statistics for the dashboard.
    Counts events, incidents, guards for today.
    """
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()

    # Total events today
    events_query = (
        supabase.table("events")
        .select("id", count="exact")
        .gte("created_at", today_start)
    )
    if company_id:
        events_query = events_query.eq("company_id", company_id)
    events_result = events_query.execute()

    # Unverified events today
    unverified_query = (
        supabase.table("events")
        .select("id", count="exact")
        .eq("verification_status", "unverified")
        .gte("created_at", today_start)
    )
    if company_id:
        unverified_query = unverified_query.eq("company_id", company_id)
    unverified_result = unverified_query.execute()

    # Open incidents
    incidents_query = (
        supabase.table("incidents")
        .select("id", count="exact")
        .in_("status", ["open", "acknowledged", "in_progress"])
    )
    if company_id:
        incidents_query = incidents_query.eq("company_id", company_id)
    incidents_result = incidents_query.execute()

    # Active guards (seen in last 12 hours)
    twelve_hours_ago = (
        datetime.now(timezone.utc) - timedelta(hours=12)
    ).isoformat()
    guards_query = (
        supabase.table("users")
        .select("id", count="exact")
        .eq("role", "guard")
        .eq("is_active", True)
        .gte("last_seen", twelve_hours_ago)
    )
    if company_id:
        guards_query = guards_query.eq("company_id", company_id)
    guards_result = guards_query.execute()

    return {
        "events_today": events_result.count or 0,
        "unverified_today": unverified_result.count or 0,
        "open_incidents": incidents_result.count or 0,
        "active_guards": guards_result.count or 0,
    }


class SendWelcomeBody(BaseModel):
    """Request body for sending the welcome_guard template."""

    to: str  # E.164 phone number, e.g. 27659410613
    guard_name: str = "Guard"  # {{1}} in template
    company_name: str = "JengoRoute"  # {{2}} in template
    language_code: Optional[str] = "en"  # Must match template language in Meta (e.g. en_US, en)


@router.post("/send-welcome")
async def send_welcome(body: SendWelcomeBody = Body(...)):
    """
    Send the welcome_guard template to a phone number.
    Body has {{1}}=guard_name, {{2}}=company_name. Buttons are fixed in the template.
    If you get "Template name does not exist in the translation", set language_code to the exact code your template uses in Meta (e.g. en, en_US).
    """
    from services.whatsapp_client import whatsapp_client

    body_params = [body.guard_name, body.company_name]
    lang = body.language_code or "en"
    result = await whatsapp_client.send_template_message(
        to=body.to,
        template_name="welcome_guard",
        language_code=lang,
        body_parameters=body_params,
    )
    if result.get("error"):
        detail = result["error"]
        if isinstance(detail, dict):
            detail = detail.get("message", str(detail))
        detail = str(detail)
        if "132001" in detail or "translation" in detail.lower():
            detail += ' Try "language_code": "en_US" or "en" in the request body to match the template language in Meta.'
        raise HTTPException(status_code=502, detail=detail)
    return {"ok": True, "whatsapp_response": result}


class SendHelloWorldBody(BaseModel):
    """Request body for sending the hello_world template (Meta's test template, no variables)."""

    to: str  # E.164 phone number
    language_code: Optional[str] = "en_US"  # English (use en_US if your template is English US)


@router.post("/send-hello-world")
async def send_hello_world(body: SendHelloWorldBody = Body(...)):
    """
    Send the hello_world template to a phone number.
    Use for testing the WhatsApp API (Meta's default template, no variables).
    """
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_template_message(
        to=body.to,
        template_name="hello_world",
        language_code=body.language_code or "en_US",
        body_parameters=None,
    )
    if result.get("error"):
        detail = result["error"]
        if isinstance(detail, dict):
            detail = detail.get("message", str(detail))
        detail = str(detail)
        if "132001" in detail or "translation" in detail.lower():
            detail += ' Try "language_code": "en_US" or "en" in the request body to match the template language in Meta.'
        raise HTTPException(status_code=502, detail=detail)
    return {"ok": True, "whatsapp_response": result}


class SendCheckinReminderBody(BaseModel):
    """Request body for sending the checkin_reminder template (no body variables)."""

    to: str  # E.164 phone number
    language_code: Optional[str] = "en"  # Try "en_US" if you get #132001


@router.post("/send-checkin-reminder")
async def send_checkin_reminder(body: SendCheckinReminderBody = Body(...)):
    """
    Send the checkin_reminder template.
    This template has no body parameters; buttons are fixed in Meta.
    """
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_template_message(
        to=body.to,
        template_name="checkin_reminder",
        language_code=body.language_code or "en_US",
        # body_parameters=[body.guard_name],
    )
    _raise_whatsapp_error_if_any(result)
    return {"ok": True, "whatsapp_response": result}


class SendGuardTemplateBody(BaseModel):
    """Generic request body for guard template sends."""

    to: str
    language_code: Optional[str] = "en"
    body_parameters: Optional[List[str]] = None


@router.post("/send-missed-checkin")
async def send_missed_checkin(body: SendGuardTemplateBody = Body(...)):
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_guard_template(
        to=body.to,
        template_name="missed_checkin",
        language_code=body.language_code or "en_US",
        body_parameters=body.body_parameters,
    )
    _raise_whatsapp_error_if_any(result)
    return {"ok": True, "whatsapp_response": result}


@router.post("/send-patrol-prompt")
async def send_patrol_prompt(body: SendGuardTemplateBody = Body(...)):
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_guard_template(
        to=body.to,
        template_name="patrol_prompt",
        language_code=body.language_code or "en_US",
        body_parameters=body.body_parameters,
    )
    _raise_whatsapp_error_if_any(result)
    return {"ok": True, "whatsapp_response": result}


@router.post("/send-incident-start")
async def send_incident_start(body: SendGuardTemplateBody = Body(...)):
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_guard_template(
        to=body.to,
        template_name="incident_start",
        language_code=body.language_code or "en_US",
        body_parameters=body.body_parameters,
    )
    _raise_whatsapp_error_if_any(result)
    return {"ok": True, "whatsapp_response": result}


@router.post("/send-location-request-template")
async def send_location_request_template(body: SendGuardTemplateBody = Body(...)):
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_guard_template(
        to=body.to,
        template_name="location_request",
        language_code=body.language_code or "en_US",
        body_parameters=body.body_parameters,
    )
    _raise_whatsapp_error_if_any(result)
    return {"ok": True, "whatsapp_response": result}


@router.post("/send-location-thanks")
async def send_location_thanks(body: SendGuardTemplateBody = Body(...)):
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_guard_template(
        to=body.to,
        template_name="location_thanks",
        language_code=body.language_code or "en_US",
        body_parameters=body.body_parameters,
    )
    _raise_whatsapp_error_if_any(result)
    return {"ok": True, "whatsapp_response": result}


@router.post("/send-shift-start")
async def send_shift_start(body: SendGuardTemplateBody = Body(...)):
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_guard_template(
        to=body.to,
        template_name="shift_start",
        language_code=body.language_code or "en_US",
        body_parameters=body.body_parameters,
    )
    _raise_whatsapp_error_if_any(result)
    return {"ok": True, "whatsapp_response": result}


@router.post("/send-shift-end")
async def send_shift_end(body: SendGuardTemplateBody = Body(...)):
    from services.whatsapp_client import whatsapp_client

    result = await whatsapp_client.send_guard_template(
        to=body.to,
        template_name="shift_end",
        language_code=body.language_code or "en_US",
        body_parameters=body.body_parameters,
    )
    _raise_whatsapp_error_if_any(result)
    return {"ok": True, "whatsapp_response": result}

