"""
models/user.py - Guard / Supervisor user data model.

Users are identified by their WhatsApp phone number.
Each user belongs to a company and has a role (guard or supervisor).
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    """User roles in the system."""
    GUARD = "guard"
    SUPERVISOR = "supervisor"
    ADMIN = "admin"


class UserBase(BaseModel):
    """Base fields for a user."""
    phone: str                            # WhatsApp phone number (with country code)
    name: str
    role: UserRole = UserRole.GUARD
    company_id: str                       # FK to companies table
    # Expected post location for check-in verification
    expected_latitude: Optional[float] = None
    expected_longitude: Optional[float] = None
    # Notification preferences
    email: Optional[str] = None
    notify_whatsapp: bool = True
    notify_email: bool = False


class UserCreate(UserBase):
    """Fields required when creating a new user."""
    pass


class User(UserBase):
    """Full user model as stored in the database."""
    id: str                               # UUID primary key
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool = True
    last_seen: Optional[datetime] = None  # Last activity timestamp

    class Config:
        from_attributes = True

