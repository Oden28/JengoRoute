"""
models/incident.py - Incident data model.

Incidents are a specialized subset of events that require
supervisor attention and tracking through resolution.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class IncidentSeverity(str, Enum):
    """Severity levels for incidents."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, Enum):
    """Lifecycle status of an incident."""
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IncidentBase(BaseModel):
    """Base fields for an incident."""
    event_id: str                                  # FK to events table
    user_id: str                                   # Guard who reported it
    company_id: str                                # FK to companies table
    title: str                                     # Short description
    description: Optional[str] = None              # Detailed description
    severity: IncidentSeverity = IncidentSeverity.MEDIUM
    status: IncidentStatus = IncidentStatus.OPEN
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    media_urls: Optional[List[str]] = []
    assigned_to: Optional[str] = None              # Supervisor user_id
    resolution_notes: Optional[str] = None


class IncidentCreate(IncidentBase):
    """Fields required when creating a new incident."""
    pass


class Incident(IncidentBase):
    """Full incident model as stored in the database."""
    id: str                                        # UUID primary key
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

