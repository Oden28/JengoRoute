"""
services/event_engine.py - Event detection and verification engine.

This is the core intelligence of JengoRoute. It:
1. Detects event type from message content (checkin, patrol, incident)
2. Runs verification checks (location, time, photo)
3. Stores structured events in PostgreSQL
4. Triggers notifications for unverified events or incidents

Verification Layer:
- Location: Compares guard GPS to expected post location
- Time: Check-in within scheduled tolerance window
- Photo: Presence of photo attachment (optional verification)
"""

import re
import logging
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, Tuple, List, Dict, Any
from geopy.distance import geodesic

from config import settings
from models.database import supabase
from models.event import EventType, VerificationStatus
from services.notification_service import notification_service

logger = logging.getLogger(__name__)


class EventEngine:
    """Detects, verifies, and stores security events."""

    # --- Event Type Detection ---

    def detect_event_type(self, text: str) -> Tuple[EventType, Optional[str]]:
        """
        Detect event type from message text using keyword matching.

        Returns:
            Tuple of (EventType, optional sector/description)

        Examples:
            "checkin"           → (CHECKIN, None)
            "patrol done B"    → (PATROL, "B")
            "incident fire"    → (INCIDENT, "fire")
        """
        if not text:
            return EventType.CHECKIN, None

        text_lower = text.strip().lower()

        # Check-in detection (including welcome_guard/shift_start buttons)
        if text_lower in (
            "checkin", "check in", "check-in", "checkin.", "arrived", "on post", "here",
        ):
            return EventType.CHECKIN, None

        if text_lower.startswith("checkin"):
            suffix = text_lower.replace("checkin", "", 1).strip(" -")
            return EventType.CHECKIN, suffix or None

        # Check-out detection (including shift_end/missed_checkin buttons)
        if text_lower in ("checkout", "check out", "check-out", "leaving", "off post", "done"):
            return EventType.CHECKOUT, None
        if re.match(r"^(?:checkout|check out|check-out|off duty|end shift|handover|overtime)\b", text_lower):
            return EventType.CHECKOUT, text

        # Patrol detection — extract sector if present
        if text_lower in ("patrol complete", "patrol incomplete"):
            return EventType.PATROL, text
        patrol_match = re.match(
            r"(?:patrol|patrolled|patrol done|patrolling)\s*(?:sector\s*)?(.+)?",
            text_lower,
        )
        if patrol_match:
            sector = patrol_match.group(1)
            return EventType.PATROL, sector.strip() if sector else None

        # Incident detection (including welcome_guard button "Report Incident(s)")
        if text_lower in ("report incident", "report incidents", "report incident.", "report incidents."):
            return EventType.INCIDENT, "Reported via welcome button"
        incident_match = re.match(
            r"(?:incident|emergency|alert|sos|help|suspicious|breach|intrusion|armed|weapon|break-?in)\s*(.*)",
            text_lower,
        )
        if incident_match:
            description = incident_match.group(1)
            return EventType.INCIDENT, description.strip() if description else "Reported via button"

        # Default: treat as check-in with description
        return EventType.CHECKIN, text

    # --- Verification Layer ---

    def verify_location(
        self,
        actual_lat: Optional[float],
        actual_lng: Optional[float],
        expected_lat: Optional[float],
        expected_lng: Optional[float],
    ) -> Tuple[bool, str]:
        """
        Verify guard location against expected post location.

        Uses geodesic distance (accounts for Earth's curvature).
        Threshold defined in settings.verification_radius_meters.

        Returns:
            Tuple of (is_verified, verification_note)
        """
        if actual_lat is None or actual_lng is None:
            return False, "No location provided"

        if expected_lat is None or expected_lng is None:
            # No expected location configured — auto-verify
            return True, "No expected location configured; auto-verified"

        # Calculate distance in meters
        actual_point = (actual_lat, actual_lng)
        expected_point = (expected_lat, expected_lng)
        distance = geodesic(actual_point, expected_point).meters

        threshold = settings.verification_radius_meters
        if distance <= threshold:
            return True, f"Location verified ({distance:.0f}m from expected post)"
        else:
            return False, (
                f"Location mismatch: {distance:.0f}m from expected post "
                f"(threshold: {threshold:.0f}m)"
            )

    def verify_time(self, event_time: Optional[datetime] = None) -> Tuple[bool, str]:
        """
        Verify that the event occurred within acceptable time window.

        For MVP, we check that the timestamp is recent (within tolerance).
        Future: Compare against guard shift schedules.

        Returns:
            Tuple of (is_verified, verification_note)
        """
        now = datetime.now(timezone.utc)
        if event_time is None:
            event_time = now

        # Ensure timezone-aware
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)

        diff_minutes = abs((now - event_time).total_seconds()) / 60
        tolerance = settings.checkin_time_tolerance_minutes

        if diff_minutes <= tolerance:
            return True, f"Time verified (within {diff_minutes:.0f}min tolerance)"
        else:
            return False, f"Time mismatch: event is {diff_minutes:.0f}min old (tolerance: {tolerance}min)"

    def verify_photo(self, media_urls: Optional[List[str]] = None) -> Tuple[bool, str]:
        """
        Check if a photo was attached to the event.

        For MVP, presence of any image counts as photo-verified.
        Future: AI-based photo verification (face recognition, scene analysis).

        Returns:
            Tuple of (is_verified, verification_note)
        """
        if media_urls and len(media_urls) > 0:
            return True, f"Photo attached ({len(media_urls)} media file(s))"
        return False, "No photo attached"

    # --- Event Processing Pipeline ---

    async def process_event(
        self,
        user: Dict[str, Any],
        text: Optional[str],
        latitude: Optional[float],
        longitude: Optional[float],
        media_urls: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Full event processing pipeline:
        1. Detect event type from message text
        2. Run verification checks
        3. Store structured event in database
        4. Trigger notifications if needed
        5. Create incident record if applicable

        Args:
            user: User dict from database (guard info)
            text: Message text content
            latitude: GPS latitude from location message
            longitude: GPS longitude from location message
            media_urls: List of uploaded media URLs

        Returns:
            Created event dict
        """
        # Step 1: Detect event type
        event_type, extra_info = self.detect_event_type(text or "")
        logger.info(f"Detected event: {event_type.value} for user {user['id']}")

        # Build description
        description = extra_info or text or f"{event_type.value} event"
        sector = extra_info if event_type == EventType.PATROL else None

        # Step 2: Run verification checks
        loc_verified, loc_note = self.verify_location(
            latitude, longitude,
            user.get("expected_latitude"),
            user.get("expected_longitude"),
        )
        time_verified, time_note = self.verify_time()
        photo_verified, photo_note = self.verify_photo(media_urls)

        # Determine overall verification status
        # Check-ins and patrols require location; incidents are pending review.
        if event_type == EventType.INCIDENT:
            verification_status = VerificationStatus.PENDING
        elif event_type == EventType.CHECKOUT:
            verification_status = VerificationStatus.VERIFIED if time_verified else VerificationStatus.UNVERIFIED
        elif loc_verified and time_verified:
            verification_status = VerificationStatus.VERIFIED
        else:
            verification_status = VerificationStatus.UNVERIFIED

        verification_notes = f"{loc_note} | {time_note} | {photo_note}"

        # Step 3: Store event in database
        event_data = {
            "user_id": user["id"],
            "company_id": user["company_id"],
            "event_type": event_type.value,
            "description": description,
            "latitude": latitude,
            "longitude": longitude,
            "media_urls": media_urls or [],
            "sector": sector,
            "verification_status": verification_status.value,
            "verification_notes": verification_notes,
            "location_verified": loc_verified,
            "time_verified": time_verified,
            "photo_verified": photo_verified,
        }

        result = supabase.table("events").insert(event_data).execute()
        event = result.data[0] if result.data else event_data
        logger.info(f"Event stored: {event.get('id', 'unknown')} ({event_type.value})")

        # Step 4: Create incident record if applicable
        if event_type == EventType.INCIDENT:
            await self._create_incident(event, user, description, latitude, longitude, media_urls)

        # Step 5: Request location when missing (check-in, patrol, incident)
        # Guard gets location prompt right away for shift check-in or incident
        if event_type in (EventType.CHECKIN, EventType.PATROL, EventType.INCIDENT) and latitude is None and longitude is None:
            await self._request_location(user)
            if event_type == EventType.INCIDENT:
                # Store marker so next location message gets linked to this incident
                supabase.table("messages").insert(
                    {
                        "whatsapp_message_id": f"flow-{uuid4()}",
                        "phone": user["phone"],
                        "direction": "outgoing",
                        "message_type": "flow_marker",
                        "body": f"awaiting_incident_location:{event.get('id')}",
                        "user_id": user["id"],
                        "processed": True,
                    }
                ).execute()
                logger.info("Incident flow: awaiting location for event %s", event.get("id"))

        # Step 6: Trigger notifications (verification result to guard, supervisor alerts if needed)
        await self._handle_notifications(event, user, event_type, verification_status)

        # Update user's last_seen
        supabase.table("users").update(
            {"last_seen": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user["id"]).execute()

        return event

    async def _create_incident(
        self,
        event: Dict[str, Any],
        user: Dict[str, Any],
        description: str,
        latitude: Optional[float],
        longitude: Optional[float],
        media_urls: Optional[List[str]],
    ):
        """Create an incident record linked to the event."""
        severity = self._derive_incident_severity(description)
        incident_data = {
            "event_id": event["id"],
            "user_id": user["id"],
            "company_id": user["company_id"],
            "title": f"Incident reported by {user['name']}",
            "description": description,
            "severity": severity,
            "status": "open",
            "latitude": latitude,
            "longitude": longitude,
            "media_urls": media_urls or [],
        }
        result = supabase.table("incidents").insert(incident_data).execute()
        logger.info(f"Incident created: {result.data[0]['id'] if result.data else 'unknown'}")

    async def _handle_notifications(
        self,
        event: Dict[str, Any],
        user: Dict[str, Any],
        event_type: EventType,
        verification_status: VerificationStatus,
    ):
        """
        Send notifications based on event type and verification status.

        Rules:
        - Incidents without location: request location first; defer supervisor notify until location received (except critical)
        - Incidents with location: send confirmation, notify supervisors
        - Critical incidents: notify immediately even without location
        - Unverified check-in/patrol: notify supervisors
        - Skip guard verification when we just sent location request (they get result when they share)
        """
        from services.whatsapp_client import whatsapp_client

        # Skip verification result to guard when we already sent location request
        skip_guard_verification = (
            event_type in (EventType.CHECKIN, EventType.PATROL, EventType.INCIDENT)
            and event.get("latitude") is None
            and event.get("longitude") is None
        )
        if not skip_guard_verification:
            if event_type == EventType.INCIDENT:
                await whatsapp_client.send_incident_confirmation(to=user["phone"])
            else:
                verified = verification_status == VerificationStatus.VERIFIED
                await whatsapp_client.send_verification_result(
                    to=user["phone"],
                    event_type=event_type.value,
                    verified=verified,
                    notes=event.get("verification_notes", ""),
                )

        # Notify supervisors: incidents with location, critical incidents (even without location), unverified events
        incident_has_location = event.get("latitude") is not None and event.get("longitude") is not None
        incident_severity_critical = self._derive_incident_severity(event.get("description", "")) == "critical"

        notify_supervisors = False
        if event_type == EventType.INCIDENT:
            notify_supervisors = incident_has_location or incident_severity_critical
        elif verification_status == VerificationStatus.UNVERIFIED:
            notify_supervisors = True

        if notify_supervisors:
            await notification_service.notify_supervisors(
                company_id=user["company_id"],
                guard_name=user["name"],
                event_type=event_type.value,
                description=event.get("description", ""),
                latitude=event.get("latitude"),
                longitude=event.get("longitude"),
            )

    async def _request_location(self, user: Dict[str, Any]):
        """Request location from guard if not provided."""
        from services.whatsapp_client import whatsapp_client
        await whatsapp_client.send_location_request(to=user["phone"])

    def _derive_incident_severity(self, description: str) -> str:
        """Simple keyword severity mapping for incident_start button categories."""
        text = (description or "").lower()
        critical_keywords = ("armed", "weapon", "attack", "fire", "gun", "shoot")
        high_keywords = ("break-in", "break in", "forced entry", "intrusion", "breach")
        if any(k in text for k in critical_keywords):
            return "critical"
        if any(k in text for k in high_keywords):
            return "high"
        return "medium"


# Singleton instance
event_engine = EventEngine()

