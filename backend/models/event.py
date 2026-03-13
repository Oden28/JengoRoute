"""
models/event.py - Security event data model.

Events represent guard actions: check-ins, patrols, and incidents.
Each event goes through a verification layer before being stored.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class EventType(str, Enum):
    """Types of security events."""
    CHECKIN = "checkin"
    PATROL = "patrol"
    INCIDENT = "incident"
    CHECKOUT = "checkout"


class VerificationStatus(str, Enum):
    """Verification status of an event."""
    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    PENDING = "pending"


class EventBase(BaseModel):
    """Base fields for a security event."""
    user_id: str                                    # FK to users table
    company_id: str                                 # FK to companies table
    event_type: EventType
    description: Optional[str] = None               # Free text from guard
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    media_urls: Optional[List[str]] = []            # URLs in Supabase Storage
    sector: Optional[str] = None                    # Patrol sector (e.g., "Sector A")
    verification_status: VerificationStatus = VerificationStatus.PENDING
    verification_notes: Optional[str] = None        # Why verified/unverified
    location_verified: bool = False
    time_verified: bool = False
    photo_verified: bool = False


class EventCreate(EventBase):
    """Fields required when creating a new event."""
    pass


class Event(EventBase):
    """Full event model as stored in the database."""
    id: str                                         # UUID primary key
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

