"""
services/whatsapp_client.py - WhatsApp Cloud API client.

Handles all outgoing communication with the WhatsApp Cloud API:
- Sending text messages
- Sending template messages
- Downloading media from WhatsApp servers

All guards interact via WhatsApp only; this is the outbound pipe.
"""

import httpx
import logging
from typing import Optional, Dict, Any

from config import settings

logger = logging.getLogger(__name__)


class WhatsAppClient:
    """Client for WhatsApp Cloud API (Meta)."""

    def __init__(self):
        self.base_url = settings.whatsapp_api_base
        self.phone_number_id = settings.whatsapp_phone_number_id
        self.access_token = settings.whatsapp_access_token
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    @property
    def messages_url(self) -> str:
        """Endpoint for sending messages."""
        return f"{self.base_url}/{self.phone_number_id}/messages"

    async def send_text_message(self, to: str, body: str) -> Dict[str, Any]:
        """
        Send a text message to a WhatsApp user.

        Args:
            to: Recipient phone number (with country code, e.g., +254711111111)
            body: Message text

        Returns:
            WhatsApp API response dict
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"body": body},
        }
        return await self._send_request(payload)

    async def send_location_request(self, to: str) -> Dict[str, Any]:
        """
        Send a message asking the guard to share their location.
        Used when a check-in is missing geolocation data.
        """
        body = (
            "📍 *Location Required*\n\n"
            "Your check-in needs location verification. "
            "Please share your current location:\n\n"
            "1. Tap the + icon\n"
            "2. Select 'Location'\n"
            "3. Send your current location"
        )
        return await self.send_text_message(to, body)

    async def send_verification_result(
        self, to: str, event_type: str, verified: bool, notes: str = ""
    ) -> Dict[str, Any]:
        """
        Notify a guard about their event verification status.

        Args:
            to: Guard phone number
            event_type: Type of event (checkin, patrol, incident)
            verified: Whether the event was verified
            notes: Additional context
        """
        status_emoji = "✅" if verified else "⚠️"
        status_text = "Verified" if verified else "Unverified"
        body = (
            f"{status_emoji} *{event_type.title()} {status_text}*\n\n"
            f"{notes}\n\n"
            "Thank you for your service."
        )
        return await self.send_text_message(to, body)

    async def send_alert_to_supervisor(
        self, to: str, guard_name: str, event_type: str, description: str,
        latitude: Optional[float] = None, longitude: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Send an alert message to a supervisor about a guard event.
        Used for incidents and unverified check-ins.
        """
        location_str = ""
        if latitude and longitude:
            location_str = f"\n📍 Location: {latitude}, {longitude}"

        body = (
            f"🚨 *Alert: {event_type.title()}*\n\n"
            f"Guard: {guard_name}\n"
            f"Details: {description}"
            f"{location_str}\n\n"
            "Please review on the dashboard."
        )
        return await self.send_text_message(to, body)

    async def download_media(self, media_id: str) -> Optional[bytes]:
        """
        Download media from WhatsApp servers.

        Flow:
        1. Get media URL from WhatsApp API using media_id
        2. Download the actual binary content

        Args:
            media_id: WhatsApp media ID from incoming message

        Returns:
            Binary content of the media file, or None on failure
        """
        try:
            # Step 1: Get the media URL
            media_url_endpoint = f"{self.base_url}/{media_id}"
            async with httpx.AsyncClient() as client:
                url_response = await client.get(
                    media_url_endpoint, headers=self.headers
                )
                url_response.raise_for_status()
                media_url = url_response.json().get("url")

                if not media_url:
                    logger.error(f"No URL returned for media_id: {media_id}")
                    return None

                # Step 2: Download the actual file
                file_response = await client.get(
                    media_url, headers=self.headers
                )
                file_response.raise_for_status()
                return file_response.content

        except httpx.HTTPError as e:
            logger.error(f"Failed to download media {media_id}: {e}")
            return None

    async def _send_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a request to the WhatsApp Cloud API.
        Handles errors and logging.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.messages_url,
                    json=payload,
                    headers=self.headers,
                )
                response.raise_for_status()
                result = response.json()
                logger.info(f"WhatsApp message sent: {result}")
                return result
        except httpx.HTTPError as e:
            logger.error(f"WhatsApp API error: {e}")
            return {"error": str(e)}


# Singleton instance
whatsapp_client = WhatsAppClient()

