"""
services/notification_service.py - Multi-channel notification service.

Sends alerts to supervisors via:
1. WhatsApp messages (primary — guards and supervisors both use WhatsApp)
2. Email (optional, for supervisors who prefer email)

Triggered by:
- Incident reports from guards
- Unverified check-ins or patrols
- System alerts
"""

import logging
import asyncio
from typing import Optional, List, Dict, Any
from email.message import EmailMessage

import aiosmtplib

from config import settings
from models.database import supabase

logger = logging.getLogger(__name__)


class NotificationService:
    """Multi-channel notification service for supervisors."""

    async def notify_supervisors(
        self,
        company_id: str,
        guard_name: str,
        event_type: str,
        description: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ):
        """
        Notify all supervisors for a given company about an event.

        Fetches supervisor list from database, then sends via
        their preferred channels (WhatsApp and/or email).
        """
        # Fetch supervisors for this company
        result = (
            supabase.table("users")
            .select("*")
            .eq("company_id", company_id)
            .eq("role", "supervisor")
            .eq("is_active", True)
            .execute()
        )
        supervisors = result.data or []

        if not supervisors:
            logger.warning(f"No active supervisors found for company {company_id}")
            return

        # Send notifications in parallel
        tasks = []
        for supervisor in supervisors:
            if supervisor.get("notify_whatsapp", True):
                tasks.append(
                    self._send_whatsapp_alert(
                        supervisor, guard_name, event_type, description,
                        latitude, longitude,
                    )
                )
            if supervisor.get("notify_email", False) and supervisor.get("email"):
                tasks.append(
                    self._send_email_alert(
                        supervisor, guard_name, event_type, description,
                        latitude, longitude,
                    )
                )

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            logger.info(f"Sent {len(tasks)} notifications for {event_type} by {guard_name}")

    async def _send_whatsapp_alert(
        self,
        supervisor: Dict[str, Any],
        guard_name: str,
        event_type: str,
        description: str,
        latitude: Optional[float],
        longitude: Optional[float],
    ):
        """Send a WhatsApp alert to a supervisor."""
        try:
            from services.whatsapp_client import whatsapp_client

            await whatsapp_client.send_alert_to_supervisor(
                to=supervisor["phone"],
                guard_name=guard_name,
                event_type=event_type,
                description=description,
                latitude=latitude,
                longitude=longitude,
            )
            logger.info(f"WhatsApp alert sent to supervisor {supervisor['name']}")
        except Exception as e:
            logger.error(f"Failed to send WhatsApp alert to {supervisor['name']}: {e}")

    async def _send_email_alert(
        self,
        supervisor: Dict[str, Any],
        guard_name: str,
        event_type: str,
        description: str,
        latitude: Optional[float],
        longitude: Optional[float],
    ):
        """Send an email alert to a supervisor."""
        try:
            location_str = ""
            if latitude and longitude:
                # Google Maps link for quick access
                location_str = (
                    f"\nLocation: https://maps.google.com/?q={latitude},{longitude}"
                )

            msg = EmailMessage()
            msg["Subject"] = f"🚨 JengoRoute Alert: {event_type.title()} by {guard_name}"
            msg["From"] = settings.notification_email_from
            msg["To"] = supervisor["email"]
            msg.set_content(
                f"Security Alert\n\n"
                f"Type: {event_type.title()}\n"
                f"Guard: {guard_name}\n"
                f"Details: {description}\n"
                f"{location_str}\n\n"
                f"View on dashboard for full details.\n\n"
                f"— JengoRoute Security Operations"
            )

            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                use_tls=True,
            )
            logger.info(f"Email alert sent to {supervisor['email']}")
        except Exception as e:
            logger.error(f"Failed to send email to {supervisor['email']}: {e}")


# Singleton instance
notification_service = NotificationService()

