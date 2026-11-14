"""Google Earth Engine service for computing erosion risk and soil capability."""

from datetime import date, timedelta
import logging
import os
import threading
from typing import Any

import ee
from django.conf import settings
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

GEE_PROJECT_ID = "prepmately"
GEE_SERVICE_ACCOUNT_EMAIL = "Gee-backend@prepmately.iam.gserviceaccount.com"
GEE_SCOPES = ["https://www.googleapis.com/auth/earthengine"]

ANALYZED_FROM_DATE = "2021-01-01"
SRTM_DATASET = "CGIAR/SRTM90_V4"
IMERG_DATASET = "NASA/GPM_L3/IMERG_MONTHLY_V06"
SOIL_TEXTURE_DATASET = "OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02"
WORLDCOVER_DATASET = "ESA/WorldCover/v100"
GEDI_DATASET = "LARSE/GEDI/GEDI02_A_002_MONTHLY"
HOURS_PER_MONTH = 720.0  # Converts IMERG monthly mean rate (mm/hr) to mm/month.

USDA_SOIL_TEXTURE_CLASSES: dict[int, str] = {
    1: "Clay",
    2: "Silty clay",
    3: "Sandy clay",
    4: "Clay loam",
    5: "Silty clay loam",
    6: "Sandy clay loam",
    7: "Loam",
    8: "Silt loam",
    9: "Sandy loam",
    10: "Silt",
    11: "Loamy sand",
    12: "Sand",
}

_init_lock = threading.Lock()
_gee_initialized = False


class GEEComputationError(Exception):
    """Raised when Google Earth Engine initialization or computation fails."""


def _get_service_account_key_path() -> str:
    """Resolve GEE key path from settings/env, Render /etc/secrets, or local backend/gee-key.json."""
    key_path = getattr(settings, "GEE_SERVICE_ACCOUNT_KEY_PATH", None) or os.environ.get(
        "GEE_SERVICE_ACCOUNT_KEY_PATH"
    )
    if not key_path:
        for candidate in (
            "/etc/secrets/gee-key.json",
            os.path.join(str(settings.BASE_DIR), "gee-key.json"),
        ):
            if os.path.isfile(candidate):
                return candidate
        raise GEEComputationError(
            "GEE service account key path is not configured. "
            "Set GEE_SERVICE_ACCOUNT_KEY_PATH or mount /etc/secrets/gee-key.json."
        )
    if not os.path.isfile(key_path):
        raise GEEComputationError(f"GEE service account key file not found at: {key_path}")
    return key_path


def initialize_gee() -> None:
    """Initialize the GEE client once using scoped service account credentials."""
    global _gee_initialized
    if _gee_initialized:
        return

    with _init_lock:
        if _gee_initialized:
            return

        key_path = _get_service_account_key_path()
        try:
            scoped_credentials = service_account.Credentials.from_service_account_file(
                key_path,
                scopes=GEE_SCOPES,
            )
            ee.Initialize(credentials=scoped_credentials, project=GEE_PROJECT_ID)
            _gee_initialized = True
        except Exception as exc:
            logger.exception("Failed to initialize Google Earth Engine.")
            raise GEEComputationError(f"GEE initialization failed: {exc}") from exc


def generate_dynamic_description(
    rain: float,
    slope: float,
    canopy: float,
    canopy_height: float,
) -> str:
    """Generate a scientific summary of rainfall, terrain, and canopy protection."""
    if rain > 300.0:
        rain_phrase = "Extreme historical rainfall"
    elif rain > 100.0:
        rain_phrase = "Moderate seasonal precipitation"
    else:
        rain_phrase = "Arid conditions with minimal rainfall"

    if slope > 15.0:
        topo_phrase = "steep, vulnerable terrain"
    elif slope > 5.0:
        topo_phrase = "rolling topography"
    else:
        topo_phrase = "relatively flat terrain"

    if canopy > 50.0 and canopy_height > 10.0:
        canopy_phrase = (
            f"buffered by dense, mature forest canopy ({canopy:.1f}% cover, "
            f"{canopy_height:.1f}m height) providing strong root-anchoring protection."
        )
    elif canopy > 50.0:
        canopy_phrase = (
            f"mitigated by dense surrounding tree cover ({canopy:.1f}%, "
            f"{canopy_height:.1f}m canopy) that helps anchor topsoil."
        )
    elif canopy >= 20.0:
        canopy_phrase = (
            f"with partial vegetative cover ({canopy:.1f}% trees, "
            f"{canopy_height:.1f}m canopy) offering moderate root stabilization."
        )
    else:
        canopy_phrase = (
            f"with sparse surrounding tree cover ({canopy:.1f}%, "
            f"{canopy_height:.1f}m canopy), leaving topsoil highly exposed to runoff."
        )

    return (
        f"{rain_phrase} ({rain:.1f} mm/month) over {topo_phrase} "
        f"(max {slope:.1f}°), {canopy_phrase}"
    )


def calculate_erosion_risk(geojson_polygon: dict[str, Any]) -> dict[str, Any]:
    """Compute Erosion Risk Score (0-100), canopy context, and USDA soil texture.

    Uses split reducers in a single GEE server round-trip:
      - SRTM slope: ee.Reducer.max() (worst-case terrain, normalized by 30 deg)
      - GPM IMERG rainfall: ee.Reducer.mean() (mm/hr * 720, normalized by 400 mm)
      - ESA WorldCover canopy (500m buffer): ee.Reducer.mean()
      - OpenLandMap USDA soil texture (band b0): ee.Reducer.mode()
    """
    initialize_gee()

    today = date.today()
    analyzed_to = today.strftime("%Y-%m-%d")
    # filterDate end is exclusive, so add one day to include today.
    end_exclusive = (today + timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        farm_geometry = ee.Geometry(geojson_polygon)

        # 1. Steepness (CGIAR/SRTM90_V4) — extract max slope in degrees.
        dem = ee.Image(SRTM_DATASET).select("elevation")
        slope_deg = ee.Terrain.slope(dem).rename("max_slope_degrees")

        # 2. Historical Max Rainfall (NASA/GPM_L3/IMERG_MONTHLY_V06) in mm/month.
        wettest_month_mm = (
            ee.ImageCollection(IMERG_DATASET)
            .filterDate(ANALYZED_FROM_DATE, end_exclusive)
            .select("precipitation")
            .max()
            .multiply(HOURS_PER_MONTH)
            .rename("mean_rainfall_mm")
        )

        # 3. Dominant USDA Soil Texture Class (band b0).
        soil_image = ee.Image(SOIL_TEXTURE_DATASET).select("b0")

        # 4. Structural Context — ESA WorldCover (10m) + NASA GEDI Canopy Height (500m buffer).
        buffered_geometry = farm_geometry.buffer(500)
        worldcover_map = ee.ImageCollection(WORLDCOVER_DATASET).first().select("Map")
        tree_mask = worldcover_map.eq(10)
        exposed_mask = worldcover_map.eq(30).Or(worldcover_map.eq(60))

        gedi_height_image = (
            ee.ImageCollection(GEDI_DATASET)
            .select("rh98")
            .mean()
            .updateMask(tree_mask)
            .rename("canopy_height_m")
        )

        structural_image = ee.Image.cat(
            [
                tree_mask.multiply(100.0).rename("tree_cover_pct"),
                exposed_mask.multiply(100.0).rename("exposed_cover_pct"),
                gedi_height_image,
            ]
        )

        combined_stats = ee.Dictionary(
            {
                "slope": slope_deg.reduceRegion(
                    reducer=ee.Reducer.max(),
                    geometry=farm_geometry,
                    scale=90,
                    bestEffort=True,
                    maxPixels=1_000_000_000,
                ),
                "rain": wettest_month_mm.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=farm_geometry,
                    scale=1000,
                    bestEffort=True,
                    maxPixels=1_000_000_000,
                ),
                "soil": soil_image.reduceRegion(
                    reducer=ee.Reducer.mode(),
                    geometry=farm_geometry,
                    scale=250,
                    bestEffort=True,
                    maxPixels=1_000_000_000,
                ),
                "canopy": structural_image.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=buffered_geometry,
                    scale=10,
                    bestEffort=True,
                    maxPixels=1_000_000_000,
                ),
            }
        ).getInfo()
    except ee.EEException as exc:
        logger.exception("Google Earth Engine computation error.")
        raise GEEComputationError(f"GEE computation failed: {exc}") from exc
    except Exception as exc:
        logger.exception("Unexpected error during GEE analysis.")
        raise GEEComputationError(f"Unexpected GEE error: {exc}") from exc

    slope_dict = combined_stats.get("slope", {}) if isinstance(combined_stats, dict) else {}
    rain_dict = combined_stats.get("rain", {}) if isinstance(combined_stats, dict) else {}
    soil_dict = combined_stats.get("soil", {}) if isinstance(combined_stats, dict) else {}
    canopy_dict = combined_stats.get("canopy", {}) if isinstance(combined_stats, dict) else {}

    raw_slope = slope_dict.get("max_slope_degrees") if isinstance(slope_dict, dict) else None
    raw_rainfall = rain_dict.get("mean_rainfall_mm") if isinstance(rain_dict, dict) else None

    if raw_slope is None or raw_rainfall is None:
        raise GEEComputationError(
            "No terrain or rainfall data available for the specified polygon."
        )

    slope_deg_val = float(raw_slope)
    rainfall_mm_val = float(raw_rainfall)

    # Aggressive normalization: 20 deg slope and 400 mm/month rainfall.
    slope_norm = min(max(slope_deg_val / 20.0, 0.0), 1.0)
    rain_norm = min(max(rainfall_mm_val / 400.0, 0.0), 1.0)
    base_score = slope_norm * rain_norm * 100.0

    raw_tree_pct = canopy_dict.get("tree_cover_pct") if isinstance(canopy_dict, dict) else None
    raw_exposed_pct = canopy_dict.get("exposed_cover_pct") if isinstance(canopy_dict, dict) else None
    raw_canopy_height = canopy_dict.get("canopy_height_m") if isinstance(canopy_dict, dict) else None

    tree_cover_pct = round(float(raw_tree_pct), 1) if raw_tree_pct is not None else 0.0
    exposed_cover_pct = round(float(raw_exposed_pct), 1) if raw_exposed_pct is not None else 0.0
    canopy_height_m = round(float(raw_canopy_height), 1) if raw_canopy_height is not None else 0.0

    # Dynamic structural context multiplier (ESA WorldCover + NASA GEDI rh98).
    if tree_cover_pct > 50.0 and canopy_height_m > 10.0:
        adjusted_score = base_score * 0.5
        canopy_status = f"Highly Protected (Canopy: {canopy_height_m:.1f}m)"
    elif exposed_cover_pct > 40.0:
        adjusted_score = base_score * 1.4
        canopy_status = f"Severely Exposed (Canopy: {canopy_height_m:.1f}m)"
    else:
        adjusted_score = base_score * 0.9
        canopy_status = f"Moderate Coverage (Canopy: {canopy_height_m:.1f}m)"

    final_score = round(min(max(adjusted_score, 0.0), 100.0), 1)

    raw_soil_code = soil_dict.get("b0") if isinstance(soil_dict, dict) else None
    soil_type = (
        USDA_SOIL_TEXTURE_CLASSES.get(int(round(float(raw_soil_code))), "Unknown")
        if raw_soil_code is not None
        else "Unknown"
    )

    dynamic_description = generate_dynamic_description(
        rain=rainfall_mm_val,
        slope=slope_deg_val,
        canopy=tree_cover_pct,
        canopy_height=canopy_height_m,
    )

    return {
        "erosion_risk_score": final_score,
        "raw_slope_degrees": round(slope_deg_val, 1),
        "raw_rainfall_mm": round(rainfall_mm_val, 1),
        "tree_cover_pct": tree_cover_pct,
        "exposed_cover_pct": exposed_cover_pct,
        "canopy_height_m": canopy_height_m,
        "canopy_status": canopy_status,
        "dynamic_description": dynamic_description,
        "soil_type": soil_type,
        "analyzed_from": ANALYZED_FROM_DATE,
        "analyzed_to": analyzed_to,
    }
