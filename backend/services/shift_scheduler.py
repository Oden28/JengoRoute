"""
services/shift_scheduler.py - Sends shift_start, missed_checkin, patrol_prompt, shift_end
templates to guards on schedule.

Runs as a separate process (scheduler_runner.py) or can be triggered manually.
Uses config-based shift times (UTC) and scheduler_log table to avoid duplicate sends.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from config import settings
from models.database import supabase
from services.whatsapp_client import whatsapp_client

logger = logging.getLogger(__name__)


def _today_utc() -> datetime:
    """Current UTC date at midnight."""
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def _shift_start_today() -> datetime:
    """Shift start time today in UTC."""
    return _today_utc().replace(
        hour=settings.shift_start_utc_hour,
        minute=settings.shift_start_utc_minute,
        second=0,
        microsecond=0,
    )


def _shift_end_today() -> datetime:
    """Shift end time today in UTC."""
    return _today_utc().replace(
        hour=settings.shift_end_utc_hour,
        minute=settings.shift_end_utc_minute,
        second=0,
        microsecond=0,
    )


def _get_active_guards() -> List[Dict[str, Any]]:
    """Fetch all active guards."""
    result = (
        supabase.table("users")
        .select("id, phone, name, company_id")
        .eq("role", "guard")
        .eq("is_active", True)
        .execute()
    )
    return result.data or []


def _already_sent_today(user_id: str, notification_type: str) -> bool:
    """Check if we already sent this notification to this user today."""
    today_start = _today_utc().isoformat()
    result = (
        supabase.table("scheduler_log")
        .select("id")
        .eq("user_id", user_id)
        .eq("notification_type", notification_type)
        .gte("sent_at", today_start)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def _log_sent(user_id: str, notification_type: str) -> None:
    """Record that we sent this notification."""
    try:
        supabase.table("scheduler_log").insert(
            {"user_id": user_id, "notification_type": notification_type}
        ).execute()
    except Exception as e:
        logger.warning("Failed to log scheduler send: %s", e)


def _has_checkin_today(user_id: str) -> bool:
    """True if guard has any checkin event today."""
    today_start = _today_utc().isoformat()
    result = (
        supabase.table("events")
        .select("id")
        .eq("user_id", user_id)
        .eq("event_type", "checkin")
        .gte("created_at", today_start)
        .limit(1)
        .execute()
    )
    return bool(result.data)


async def _send_template_to_guard(guard: Dict[str, Any], template_name: str) -> bool:
    """Send template to guard; return True if sent successfully."""
    phone = (guard.get("phone") or "").strip().replace("+", "").replace(" ", "")
    if not phone:
        return False
    resp = await whatsapp_client.send_guard_template(
        to=phone,
        template_name=template_name,
        language_code="en",
        body_parameters=None,
    )
    if resp.get("error"):
        logger.warning("Scheduler: failed to send %s to %s: %s", template_name, phone, resp.get("error"))
        return False
    return True


async def run_shift_scheduler_tick() -> Dict[str, int]:
    """
    Run one scheduler tick. Sends shift_start, missed_checkin, patrol_prompt, shift_end
    to guards who qualify. Returns counts of messages sent.
    """
    now = datetime.now(timezone.utc)
    shift_start = _shift_start_today()
    shift_end = _shift_end_today()
    guards = _get_active_guards()

    stats = {"shift_start": 0, "missed_checkin": 0, "patrol_prompt": 0, "shift_end": 0}

    for guard in guards:
        user_id = guard["id"]

        # shift_start: within first 15 min of shift start
        if shift_start <= now <= shift_start + timedelta(minutes=15):
            if not _already_sent_today(user_id, "shift_start"):
                if await _send_template_to_guard(guard, "shift_start"):
                    _log_sent(user_id, "shift_start")
                    stats["shift_start"] += 1
                    logger.info("Scheduler: sent shift_start to %s", guard.get("name"))

        # missed_checkin: 15+ min past shift start, no checkin today
        if now >= shift_start + timedelta(minutes=settings.missed_checkin_delay_minutes):
            if not _already_sent_today(user_id, "missed_checkin"):
                if not _has_checkin_today(user_id):
                    if await _send_template_to_guard(guard, "missed_checkin"):
                        _log_sent(user_id, "missed_checkin")
                        stats["missed_checkin"] += 1
                        logger.info("Scheduler: sent missed_checkin to %s", guard.get("name"))

        # patrol_prompt: offset minutes into shift
        patrol_time = shift_start + timedelta(minutes=settings.patrol_prompt_offset_minutes)
        if now >= patrol_time:
            if not _already_sent_today(user_id, "patrol_prompt"):
                if await _send_template_to_guard(guard, "patro_prompt"):
                    _log_sent(user_id, "patrol_prompt")
                    stats["patrol_prompt"] += 1
                    logger.info("Scheduler: sent patrol_prompt to %s", guard.get("name"))

        # shift_end: after shift end time
        if now >= shift_end:
            if not _already_sent_today(user_id, "shift_end"):
                if await _send_template_to_guard(guard, "shift_end"):
                    _log_sent(user_id, "shift_end")
                    stats["shift_end"] += 1
                    logger.info("Scheduler: sent shift_end to %s", guard.get("name"))

    return stats


async def run_scheduler_loop() -> None:
    """Run scheduler ticks at configured interval until cancelled."""
    interval = settings.scheduler_interval_seconds
    logger.info("Shift scheduler started (interval=%ds)", interval)
    while True:
        try:
            stats = await run_shift_scheduler_tick()
            if any(stats.values()):
                logger.info("Scheduler tick: %s", stats)
        except Exception as e:
            logger.error("Scheduler tick failed: %s", e, exc_info=True)
        await asyncio.sleep(interval)
