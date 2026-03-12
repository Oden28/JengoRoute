"""
services/media_service.py - Media handling via Supabase Storage.

Handles:
- Downloading media from WhatsApp Cloud API
- Uploading to Supabase Storage bucket
- Generating public URLs for dashboard display

Media types: images (photos), audio (voice notes), documents.
"""

import logging
import uuid
from typing import Optional
from datetime import datetime

from config import settings
from models.database import supabase
from services.whatsapp_client import whatsapp_client

logger = logging.getLogger(__name__)

# MIME type to file extension mapping
MIME_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/opus": ".opus",
    "application/pdf": ".pdf",
    "video/mp4": ".mp4",
}


class MediaService:
    """Handles media upload/download between WhatsApp and Supabase Storage."""

    def __init__(self):
        self.bucket = settings.supabase_storage_bucket

    async def process_media(
        self,
        media_id: str,
        mime_type: str,
        company_id: str,
        event_type: str = "general",
    ) -> Optional[str]:
        """
        Full media processing pipeline:
        1. Download from WhatsApp
        2. Upload to Supabase Storage
        3. Return public URL

        Args:
            media_id: WhatsApp media ID
            mime_type: MIME type of the media
            company_id: Company ID for folder organization
            event_type: Event type for folder organization

        Returns:
            Public URL of the uploaded media, or None on failure
        """
        try:
            # Step 1: Download from WhatsApp
            logger.info(f"Downloading media {media_id} from WhatsApp...")
            content = await whatsapp_client.download_media(media_id)
            if not content:
                logger.error(f"Failed to download media {media_id}")
                return None

            # Step 2: Generate storage path
            extension = MIME_EXTENSIONS.get(mime_type, ".bin")
            date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
            file_name = f"{uuid.uuid4()}{extension}"
            storage_path = f"{company_id}/{event_type}/{date_prefix}/{file_name}"

            # Step 3: Upload to Supabase Storage
            logger.info(f"Uploading to Supabase Storage: {storage_path}")
            result = supabase.storage.from_(self.bucket).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": mime_type},
            )

            # Step 4: Get public URL
            public_url = supabase.storage.from_(self.bucket).get_public_url(
                storage_path
            )
            logger.info(f"Media uploaded successfully: {public_url}")
            return public_url

        except Exception as e:
            logger.error(f"Media processing failed for {media_id}: {e}")
            return None

    def get_public_url(self, storage_path: str) -> str:
        """Get the public URL for an existing file in storage."""
        return supabase.storage.from_(self.bucket).get_public_url(storage_path)


# Singleton instance
media_service = MediaService()

