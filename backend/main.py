"""
main.py - FastAPI application entry point for JengoRoute backend.

This is the main server that:
1. Receives WhatsApp webhook callbacks
2. Serves REST API endpoints for the dashboard
3. Initializes connections to Redis, Supabase, and Sentry

Run with: uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes.whatsapp import router as whatsapp_router
from routes.api import router as api_router

# --- Logging setup ---
logging.basicConfig(
    level=logging.DEBUG if settings.app_debug else logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


# --- Sentry initialization (optional) ---
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.2,
        environment=settings.app_env,
    )
    logger.info("Sentry initialized")


# --- Application lifespan (startup/shutdown) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    logger.info("🚀 JengoRoute backend starting up...")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Redis URL: {settings.redis_url}")
    logger.info(f"Supabase URL: {settings.supabase_url}")
    yield
    logger.info("👋 JengoRoute backend shutting down...")


# --- FastAPI app ---
app = FastAPI(
    title="JengoRoute Security Operations API",
    description=(
        "WhatsApp-native security operations platform. "
        "Receives guard check-ins, patrols, and incident reports via WhatsApp. "
        "Processes and verifies events, stores in Supabase, "
        "and serves data to the Next.js dashboard."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# --- CORS (allow Next.js frontend) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",       # Local Next.js dev
        "http://127.0.0.1:3000",      # Alternative local URL (same-origin differs from localhost)
        "https://*.vercel.app",        # Vercel deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register routes ---
app.include_router(whatsapp_router)
app.include_router(api_router)


# --- Health check ---
@app.get("/health")
async def health_check():
    """Simple health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "service": "jengoroute-backend",
        "version": "0.1.0",
        "environment": settings.app_env,
    }


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "service": "JengoRoute Security Operations API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
        "webhook": "/webhook/whatsapp",
    }

