"""
models/company.py - Company (security firm) data model.

Each company represents a security firm using JengoRoute.
Companies have guards (users) and define expected patrol zones.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CompanyBase(BaseModel):
    """Base fields for a security company."""
    name: str
    phone: Optional[str] = None          # Primary contact phone
    email: Optional[str] = None          # Primary contact email
    address: Optional[str] = None
    # Default location for the company HQ (lat/lng)
    hq_latitude: Optional[float] = None
    hq_longitude: Optional[float] = None


class CompanyCreate(CompanyBase):
    """Fields required when creating a new company."""
    pass


class Company(CompanyBase):
    """Full company model as stored in the database."""
    id: str                               # UUID primary key
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool = True

    class Config:
        from_attributes = True

