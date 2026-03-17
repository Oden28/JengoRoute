"""
worker.py - Redis RQ worker for async message processing.

This runs as a separate process from the FastAPI server.
It pulls jobs from the Redis queue and processes them.

Jobs are enqueued by the WhatsApp webhook handler and processed
by the message_processor service.

Run with: python worker.py
Or with: rq worker whatsapp_messages --url redis://localhost:6379/0

Note: For async function support, we use a custom worker loop
that runs the async functions in an event loop.
"""

# Avoid macOS fork crash when RQ spawns job workers (ObjC must be set before process starts)
import os
import sys
if sys.platform == "darwin" and os.environ.get("OBJC_DISABLE_INITIALIZE_FORK_SAFETY") != "YES":
    os.environ["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"
    os.execve(sys.executable, [sys.executable] + sys.argv, os.environ)

import asyncio
import logging
import traceback

from redis import Redis
from rq import Worker, Queue, Connection

from config import settings
from models.database import reinit_supabase_for_fork

# --- Logging setup ---
logging.basicConfig(
    level=logging.DEBUG if settings.app_debug else logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


class AsyncWorker(Worker):
    """
    Custom RQ Worker that supports async job functions.

    Standard RQ workers can't run async functions directly.
    This wrapper detects coroutines and runs them in an event loop.
    """

    def perform_job(self, job, queue):
        """Override to handle async job functions."""
        # Fresh DB client in the forked child (parent's connections are unsafe after fork)
        reinit_supabase_for_fork()

        func = job.func

        if asyncio.iscoroutinefunction(func):
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                # RQ's job.func is read-only; wrap execution via job.perform instead
                def run_async_perform():
                    return loop.run_until_complete(
                        func(*job.args, **job.kwargs)
                    )
                original_perform = job.perform
                job.perform = run_async_perform
                try:
                    return super().perform_job(job, queue)
                finally:
                    job.perform = original_perform
            except Exception as e:
                logger.error(
                    "Job %s failed: %s\n%s",
                    job.id, e, traceback.format_exc(),
                )
                raise
            finally:
                loop.close()
        else:
            try:
                return super().perform_job(job, queue)
            except Exception as e:
                logger.error(
                    "Job %s failed: %s\n%s",
                    job.id, e, traceback.format_exc(),
                )
                raise


def main():
    """Start the RQ worker."""
    redis_conn = Redis.from_url(settings.redis_url)

    # Listen on the whatsapp_messages queue
    queues = [Queue("whatsapp_messages", connection=redis_conn)]

    logger.info("🔧 Starting JengoRoute RQ Worker...")
    logger.info(f"Redis URL: {settings.redis_url}")
    logger.info(f"Listening on queues: {[q.name for q in queues]}")

    with Connection(redis_conn):
        worker = AsyncWorker(queues, connection=redis_conn)
        worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()

