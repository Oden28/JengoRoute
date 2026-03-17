"""
models/database.py - Supabase client initialization.

Provides a singleton Supabase client used across the backend
for database queries and storage operations.
"""

from supabase import create_client, Client
from config import settings


def get_supabase_client() -> Client:
    """
    Create and return a Supabase client using the service role key.
    Service role key bypasses RLS — used for backend operations.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key
    )


# Singleton client instance for reuse
supabase: Client = get_supabase_client()


def reinit_supabase_for_fork() -> None:
    """
    Create a fresh Supabase client. Call this at the start of each RQ job.
    After fork(), the parent's HTTP connections are unsafe in the child;
    using a new client avoids exit 1 / connection errors in the worker.
    """
    global supabase
    supabase = get_supabase_client()

