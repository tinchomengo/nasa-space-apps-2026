"""Shared constants and paths for the offline precompute pipeline."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
KERNELS = DATA / "kernels"
DEM_NEAR = DATA / "dem" / "near"
DEM_FAR = DATA / "dem" / "far"
HORIZONS_CACHE = DATA / "horizons_cache"
WEB_DATA = ROOT / "web" / "public" / "data"

# SPICE kernels (Skyfield "position on the Moon" approach)
KERNEL_EPHEM = "de421.bsp"
KERNEL_MOON_FK = "moon_080317.tf"
KERNEL_PCK = "pck00008.tpc"
KERNEL_MOON_PA = "moon_pa_de421_1900-2050.bpc"
MOON_FRAME = "MOON_ME_DE421"

# Far-field DEM: LOLA GDR polar, 120 m/px, poleward of 75°S.
# Label: heights in KILOMETERS relative to a 1737.4 km sphere.
FAR_DEM_IMG = "LDEM_75S_120M_FLOAT.IMG"
FAR_DEM_LBL = "LDEM_75S_120M_FLOAT.LBL"

# Geometry
MOON_RADIUS_M = 1_737_400.0
SUN_RADIUS_KM = 696_340.0
EARTH_RADIUS_KM = 6_371.0
OBSERVER_HEIGHT_M = 2.0  # mast/antenna height above the surface; report everywhere

# Horizon mask
N_AZIMUTHS = 720  # 0.5° bins, clockwise from local north
HORIZON_MAX_RANGE_M = 150_000.0

# Time span (UTC)
SPAN_START = "2026-11-01T00:00:00Z"
SPAN_END = "2029-01-01T00:00:00Z"
COMPUTE_STEP_MIN = 10
EXPORT_STEP_MIN = 60

# Countdown thresholds (hours until set)
GREEN_H = 72
AMBER_H = 24

# Ground stations
STATION_MASK_DEG = 10.0
