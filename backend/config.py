"""
config.py - Centralized configuration for JengoRoute backend.
Loads environment variables with sensible defaults.
Uses pydantic-settings for validation.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- WhatsApp Cloud API ---
    whatsapp_verify_token: str = "jengoroute-verify-token"
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_api_version: str = "v18.0"

    # --- Supabase ---
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    supabase_storage_bucket: str = "jengoroute-media"

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Sentry ---
    sentry_dsn: Optional[str] = None

    # --- Email ---
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    notification_email_from: str = "alerts@jengoroute.com"

    # --- App ---
    app_env: str = "development"
    app_debug: bool = True
    verification_radius_meters: float = 200.0  # Max distance for location verification
    checkin_time_tolerance_minutes: int = 30    # Tolerance window for check-in times

    # --- Shift scheduler (UTC) ---
    shift_start_utc_hour: int = 6           # e.g. 6 = 06:00 UTC
    shift_start_utc_minute: int = 0
    shift_end_utc_hour: int = 14            # e.g. 14 = 14:00 UTC (8hr shift)
    shift_end_utc_minute: int = 0
    missed_checkin_delay_minutes: int = 15   # Send missed_checkin if no checkin by this many mins after shift_start
    patrol_prompt_offset_minutes: int = 240 # Send patrol_prompt this many mins into shift (e.g. 4hr)
    scheduler_interval_seconds: int = 300   # How often scheduler runs (default 5 min)

    @property
    def whatsapp_api_base(self) -> str:
        """Base URL for WhatsApp Cloud API."""
        return f"https://graph.facebook.com/{self.whatsapp_api_version}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton settings instance
settings = Settings()

