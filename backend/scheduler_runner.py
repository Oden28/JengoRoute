#!/usr/bin/env python3
"""
scheduler_runner.py - Standalone process that runs the shift scheduler.

Starts the shift_scheduler loop (shift_start, missed_checkin, patrol_prompt, shift_end).
Run alongside the main app and worker:

  python scheduler_runner.py

Environment: Same as backend (SUPABASE_URL, WHATSAPP_*, shift config vars).
"""

import asyncio
import logging
import sys

# Add project root to path
sys.path.insert(0, ".")

from services.shift_scheduler import run_scheduler_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    try:
        asyncio.run(run_scheduler_loop())
    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user")


if __name__ == "__main__":
    main()
