from __future__ import annotations

import logging
import threading

from celery import chain, shared_task

from accounts.models import FarmerProfile
from rotation.services.rotation_engine import run_rotation_pipeline_for_profile
from telemetry.views import compute_and_save_farmer_telemetry
from terrain.views import compute_and_save_farmer_terrain

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def run_module_1(self, profile_id: int) -> int:
    profile = FarmerProfile.objects.get(pk=profile_id)
    compute_and_save_farmer_telemetry(profile)
    return profile_id


@shared_task(bind=True)
def run_module_2(self, profile_id: int) -> int:
    profile = FarmerProfile.objects.get(pk=profile_id)
    compute_and_save_farmer_terrain(profile)
    return profile_id


@shared_task(bind=True)
def run_module_3(self, profile_id: int) -> int:
    profile = FarmerProfile.objects.get(pk=profile_id)
    run_rotation_pipeline_for_profile(profile)
    return profile_id


def trigger_farmer_pipeline(profile_id: int) -> None:
    """Queue Module 1 -> 2 -> 3 via Celery, falling back to a daemon thread."""

    try:
        chain(run_module_1.s(profile_id), run_module_2.s(), run_module_3.s()).apply_async()
    except Exception as exc:
        logger.warning('Celery dispatch unavailable (%s); running pipeline in background thread.', exc)

        def _run_local() -> None:
            try:
                profile = FarmerProfile.objects.get(pk=profile_id)
                compute_and_save_farmer_telemetry(profile)
                compute_and_save_farmer_terrain(profile)
                run_rotation_pipeline_for_profile(profile)
            except Exception:
                logger.exception('Background Module 1-3 pipeline failed for profile %s', profile_id)

        threading.Thread(target=_run_local, daemon=True).start()
