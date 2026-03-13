"""
models/message.py - Raw WhatsApp message data model.

Every incoming WhatsApp message is stored as-is for audit trail
before being processed by the Event Engine.
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class MessageType(str, Enum):
    """Types of WhatsApp messages we handle."""
    TEXT = "text"
    LOCATION = "location"
    IMAGE = "image"
    AUDIO = "audio"         # Voice notes
    DOCUMENT = "document"
    UNKNOWN = "unknown"


class MessageDirection(str, Enum):
    """Direction of the message."""
    INCOMING = "incoming"
    OUTGOING = "outgoing"


class MessageBase(BaseModel):
    """Base fields for a WhatsApp message."""
    whatsapp_message_id: str                # WhatsApp's unique message ID
    phone: str                              # Sender/recipient phone number
    direction: MessageDirection = MessageDirection.INCOMING
    message_type: MessageType = MessageType.TEXT
    body: Optional[str] = None              # Text content
    latitude: Optional[float] = None        # Location message lat
    longitude: Optional[float] = None       # Location message lng
    media_id: Optional[str] = None          # WhatsApp media ID (for download)
    media_url: Optional[str] = None         # Stored URL in Supabase Storage
    media_mime_type: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None  # Full raw webhook payload
    user_id: Optional[str] = None           # Resolved user FK (if known)
    processed: bool = False                 # Whether Event Engine has processed it


class MessageCreate(MessageBase):
    """Fields required when storing a new message."""
    pass


class Message(MessageBase):
    """Full message model as stored in the database."""
    id: str                                 # UUID primary key
    created_at: datetime

    class Config:
        from_attributes = True

