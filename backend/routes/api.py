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
from typing import Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, HTTPException

from models.database import supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["dashboard"])


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
        "*, users(name, phone), events(event_type, verification_status)"
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
        .select("*, users(name, phone), events(*)")
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

