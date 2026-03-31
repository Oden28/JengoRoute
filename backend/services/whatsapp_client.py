"""
services/whatsapp_client.py - WhatsApp Cloud API client.

Handles all outgoing communication with the WhatsApp Cloud API:
- Sending text messages
- Sending template messages
- Downloading media from WhatsApp servers

All guards interact via WhatsApp only; this is the outbound pipe.
"""

import json
import httpx
import logging
from typing import Optional, Dict, Any, List

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

    async def send_template_message(
        self,
        to: str,
        template_name: str,
        language_code: str = "en_US",
        body_parameters: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a pre-approved WhatsApp template (e.g. welcome_guard).
        Use for first contact or when the user hasn't messaged in 24+ hours.

        Args:
            to: Recipient phone number (E.164, e.g. 27659410613)
            template_name: Template name as created in Meta (e.g. welcome_guard)
            language_code: Template language (e.g. en_US)
            body_parameters: Optional list of strings for {{1}}, {{2}}, ... in template body

        Returns:
            WhatsApp API response dict
        """
        template: Dict[str, Any] = {
            "name": template_name,
            "language": {"code": language_code},
        }
        if body_parameters:
            # Official format: body parameters are ordered for {{1}}, {{2}}, ... (type + text only; no parameter_name when sending)
            template["components"] = [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in body_parameters],
                }
            ]
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.strip().replace("+", "").replace(" ", ""),
            "type": "template",
            "template": template,
        }
        return await self._send_request(payload)

    async def send_guard_template(
        self,
        to: str,
        template_name: str,
        language_code: str = "en_US",
        body_parameters: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Small semantic wrapper for guard-facing templates."""
        return await self.send_template_message(
            to=to,
            template_name=template_name,
            language_code=language_code,
            body_parameters=body_parameters,
        )

    async def send_location_request(self, to: str) -> Dict[str, Any]:
        """
         Ask the guard to share their location.
        Prefer the `location_request` template and fall back to text if unavailable.
        """
        template_resp = await self.send_guard_template(
            to=to,
            template_name="location_request",
            language_code="en_US",
            body_parameters=None,
        )
        if not template_resp.get("error"):
            return template_resp
        body = (
            "📍 *Location Required*\n\n"
            "Your check-in needs location verification. "
            "Please share your current location:\n\n"
            "1. Tap the + icon\n"
            "2. Select 'Location'\n"
            "3. Send your current location"
        )
        return await self.send_text_message(to, body)
    
    async def send_location_thanks(self, to: str) -> Dict[str, Any]:
        """
        Thank a guard after they share location.
        Prefer `location_thanks` template and fall back to simple text.
        """
        template_resp = await self.send_guard_template(
            to=to,
            template_name="location_thanks",
            language_code="en_US",
            body_parameters=None,
        )
        if not template_resp.get("error"):
            return template_resp
        return await self.send_text_message(
            to=to,
            body="✅ Location received. Thank you.",
        )

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

    async def send_incident_confirmation(self, to: str) -> Dict[str, Any]:
        """
        Confirm to guard that their incident was received and supervisors notified.
        Used when incident flow is complete (details + location captured).
        """
        body = (
            "🚨 *Incident received*\n\n"
            "Supervisors have been notified and will respond shortly. "
            "Thank you for reporting."
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
        # Log the outbound message (to, type, text/template) so you can see what we're sending
        logger.info(
            "=== WhatsApp outbound message ===\n%s",
            json.dumps(payload, indent=2, default=str),
        )
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.messages_url,
                    json=payload,
                    headers=self.headers,
                )
                try:
                    body = response.json()
                except Exception:
                    body = response.text or ""
                if response.status_code >= 400:
                    msg = body.get("error", body) if isinstance(body, dict) else body
                    if isinstance(msg, dict):
                        msg = msg.get("message", str(msg))
                    logger.error("WhatsApp API error %s: %s", response.status_code, msg)
                    return {"error": msg, "status_code": response.status_code}
                logger.info("WhatsApp API response: %s", body)
                return body
        except httpx.HTTPError as e:
            logger.error(f"WhatsApp API error: {e}")
            return {"error": str(e)}


# Singleton instance
whatsapp_client = WhatsAppClient()

