"""Sun and Earth positions seen from a point on the Moon.

Uses Skyfield's documented "position on the Moon" approach: DE421 ephemeris plus the
MOON_ME_DE421 body-fixed frame (moon_080317.tf, pck00008.tpc, moon_pa_de421_1900-2050.bpc).

- Apparent positions (light time, aberration, gravitational deflection).
- NO atmospheric refraction: altaz() is called without temperature/pressure.
- Lunar physical librations and the Moon's orbital motion are inherent in the ephemeris
  and the frame, so Earth's wander in the lunar sky is modelled, not approximated.
- Azimuth: degrees clockwise from local north (0 = N, 90 = E). Elevation: degrees above the
  local horizontal plane, defined by the sphere normal (radius vector) at the site.
- Site elevation is metres above the 1737.4 km reference sphere (BODY301_RADII), the same
  reference as the LOLA DEMs.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache

import numpy as np
from skyfield.api import Loader
from skyfield.planetarylib import PlanetaryConstants

from pipeline import config

BODIES = ("sun", "earth")
BODY_RADIUS_KM = {"sun": config.SUN_RADIUS_KM, "earth": config.EARTH_RADIUS_KM}


@dataclass(frozen=True)
class Kernels:
    ts: object
    eph: object
    pc: PlanetaryConstants
    frame: object


@lru_cache(maxsize=1)
def load_kernels() -> Kernels:
    ld = Loader(str(config.KERNELS), verbose=False)
    for name in (config.KERNEL_EPHEM, config.KERNEL_MOON_FK, config.KERNEL_PCK, config.KERNEL_MOON_PA):
        if not (config.KERNELS / name).exists():
            raise FileNotFoundError(f"missing kernel {name}; run pipeline/fetch_data.sh")
    ts = ld.timescale(builtin=True)
    eph = ld(config.KERNEL_EPHEM)
    pc = PlanetaryConstants()
    pc.read_text(ld(config.KERNEL_MOON_FK))
    pc.read_text(ld(config.KERNEL_PCK))
    pc.read_binary(ld(config.KERNEL_MOON_PA))
    frame = pc.build_frame_named(config.MOON_FRAME)
    return Kernels(ts, eph, pc, frame)


def site_topos(lat_deg: float, lon_deg: float, elev_m: float = 0.0):
    """Skyfield vector (Moon centre + body-fixed surface point) for a lunar site."""
    k = load_kernels()
    return k.eph["moon"] + k.pc.build_latlon_degrees(k.frame, lat_deg, lon_deg, elevation_m=elev_m)


def utc_times(dts: list[datetime] | np.ndarray):
    """Skyfield Time array from timezone-aware UTC datetimes."""
    return load_kernels().ts.from_datetimes(list(dts))


def utc_range(start: datetime, end: datetime, step_min: float):
    """Regular UTC grid [start, end) at step_min minutes. Returns (Time, unix_seconds).

    Built as SI-second offsets from a Skyfield Time anchored at `start`. (Anchoring at the Unix
    epoch would be off by the 27 leap seconds since 1970.) Exact as long as no leap second falls
    inside the span; none are scheduled for 2026-2028, and the assert below catches one if it does.
    """
    k = load_kernels()
    start = start if start.tzinfo else start.replace(tzinfo=timezone.utc)
    end = end if end.tzinfo else end.replace(tzinfo=timezone.utc)
    offsets = np.arange(0.0, end.timestamp() - start.timestamp(), step_min * 60.0)
    t_start = k.ts.from_datetime(start)
    t = k.ts.tt_jd(t_start.whole, t_start.tt_fraction + offsets / 86400.0)
    last = k.ts.from_datetime(datetime.fromtimestamp(start.timestamp() + offsets[-1], tz=timezone.utc))
    assert abs((t[-1].tt - last.tt) * 86400.0) < 1e-3, "leap second inside span: rebuild grid"
    return t, start.timestamp() + offsets


def topocentric(lat_deg: float, lon_deg: float, elev_m: float, t, body: str, chunk: int = 20000) -> dict:
    """Apparent az/el/distance of `body` ('sun' | 'earth') from a lunar site, no refraction.

    Returns dict of numpy arrays: az_deg [0, 360), el_deg, dist_km, ang_radius_deg.
    """
    if body not in BODIES:
        raise ValueError(body)
    k = load_kernels()
    site = site_topos(lat_deg, lon_deg, elev_m)
    target = k.eph[body]
    n = len(t) if t.shape else 1
    az, el, dist = np.empty(n), np.empty(n), np.empty(n)
    for i in range(0, n, chunk):
        ti = t[i:i + chunk] if t.shape else t
        alt_a, az_a, d = site.at(ti).observe(target).apparent().altaz()  # no temperature/pressure => no refraction
        az[i:i + chunk] = az_a.degrees
        el[i:i + chunk] = alt_a.degrees
        dist[i:i + chunk] = d.km
    return {
        "az_deg": az % 360.0,
        "el_deg": el,
        "dist_km": dist,
        "ang_radius_deg": np.degrees(np.arcsin(BODY_RADIUS_KM[body] / dist)),
    }


# --- Our own local frame (used by horizon.py); must agree with Skyfield's altaz ----------

def unit_vector_me(lat_deg, lon_deg) -> np.ndarray:
    """Unit radius vector in MOON_ME for planetocentric lat/lon (degrees). Shape (..., 3)."""
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=-1)


def enu_basis(lat_deg: float, lon_deg: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """East, north, up unit vectors (MOON_ME) at a site: up = r̂, east = ẑ × up, north = up × east."""
    up = unit_vector_me(lat_deg, lon_deg)
    east = np.cross([0.0, 0.0, 1.0], up)
    east /= np.linalg.norm(east)
    north = np.cross(up, east)
    return east, north, up


def az_el_from_vectors(v_me: np.ndarray, lat_deg: float, lon_deg: float) -> tuple[np.ndarray, np.ndarray]:
    """Azimuth (clockwise from north) and elevation (deg) of MOON_ME direction vectors (..., 3)."""
    e, n, u = enu_basis(lat_deg, lon_deg)
    v = v_me / np.linalg.norm(v_me, axis=-1, keepdims=True)
    az = np.degrees(np.arctan2(v @ e, v @ n)) % 360.0
    el = np.degrees(np.arcsin(np.clip(v @ u, -1.0, 1.0)))
    return az, el


def body_vectors_me(lat_deg: float, lon_deg: float, elev_m: float, t, body: str) -> np.ndarray:
    """Apparent site->body vectors expressed in MOON_ME (km), shape (N, 3)."""
    k = load_kernels()
    app = site_topos(lat_deg, lon_deg, elev_m).at(t).observe(k.eph[body]).apparent()
    return np.asarray(app.frame_xyz(k.frame).km).T
