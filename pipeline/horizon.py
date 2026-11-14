"""Terrain horizon mask via vectorized 3D ray-march over the LOLA DEMs.

For each of N azimuths (clockwise from local north, same ENU basis as ephem.py, which is tested
against Skyfield's altaz), march outward along the great circle on the 1737.4 km sphere with
geometrically growing steps, sample terrain height h, build the 3D point P = (R + h)·p̂, and
take the elevation angle from the observer O = (R + h_site + h_obs)·û. The horizon is the max
over the ray. Curvature is exact (no d²/2R approximation).
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable

import numpy as np

from pipeline import config
from pipeline.ephem import enu_basis, unit_vector_me

R = config.MOON_RADIUS_M
HeightFn = Callable[[np.ndarray, np.ndarray], np.ndarray]  # (lat_deg, lon_deg) -> metres above sphere


@dataclass
class HorizonResult:
    az_deg: np.ndarray  # (N,) bin centres: 0, 0.5, ... clockwise from north
    el_deg: np.ndarray  # (N,) horizon elevation
    dist_m: np.ndarray  # (N,) distance to the horizon-defining point
    site_height_m: float
    observer_height_m: float
    seconds: float


def ray_distances(min_step=5.0, max_step=200.0, growth=1.03, max_range=config.HORIZON_MAX_RANGE_M) -> np.ndarray:
    d, s, out = 0.0, min_step, []
    while d < max_range:
        d += s
        out.append(min(d, max_range))
        s = min(s * growth, max_step)
    return np.array(out)


def smooth_sphere_dip_deg(height_above_sphere_m: float) -> float:
    """Geometric horizon dip for an observer at this height above a smooth sphere (negative)."""
    return -np.degrees(np.arccos(R / (R + height_above_sphere_m)))


def compute_horizon(lat: float, lon: float, heights: HeightFn, h_obs: float = config.OBSERVER_HEIGHT_M,
                    n_az: int = config.N_AZIMUTHS, dists: np.ndarray | None = None,
                    site_height_m: float | None = None) -> HorizonResult:
    t0 = time.perf_counter()
    dists = ray_distances() if dists is None else dists
    e, n, u = enu_basis(lat, lon)
    if site_height_m is None:
        site_height_m = float(heights(np.array([lat]), np.array([lon]))[0])
    if not np.isfinite(site_height_m):
        raise ValueError(f"no terrain height at site ({lat}, {lon})")

    az = np.arange(n_az) * (360.0 / n_az)
    a = np.radians(az)[:, None]
    th = (dists / R)[None, :]
    # unit vectors along each ray: p̂ = cos θ·u + sin θ·(cos az·n + sin az·e)
    dir_ = np.cos(a)[..., None] * n + np.sin(a)[..., None] * e  # (A,1,3)
    p = np.cos(th)[..., None] * u + np.sin(th)[..., None] * dir_  # (A,K,3)
    lat_p = np.degrees(np.arcsin(np.clip(p[..., 2], -1, 1)))
    lon_p = np.degrees(np.arctan2(p[..., 1], p[..., 0]))
    h = heights(lat_p, lon_p)

    obs = (R + site_height_m + h_obs) * u
    v = (R + h)[..., None] * p - obs
    el = np.degrees(np.arcsin(np.clip((v @ u) / np.linalg.norm(v, axis=-1), -1, 1)))
    el = np.where(np.isfinite(el), el, -np.inf)
    k = np.argmax(el, axis=1)
    hz = el[np.arange(n_az), k]
    dist = dists[k]
    none = ~np.isfinite(hz)  # whole ray without data -> smooth-sphere dip
    hz[none] = smooth_sphere_dip_deg(site_height_m + h_obs)
    dist[none] = np.nan
    return HorizonResult(az, hz, dist, site_height_m, h_obs, time.perf_counter() - t0)


def smooth_sphere_horizon(h_obs: float = config.OBSERVER_HEIGHT_M, n_az: int = config.N_AZIMUTHS) -> HorizonResult:
    az = np.arange(n_az) * (360.0 / n_az)
    return HorizonResult(az, np.full(n_az, smooth_sphere_dip_deg(h_obs)), np.full(n_az, np.sqrt(2 * R * h_obs)),
                         0.0, h_obs, 0.0)


def site_horizon(lat: float, lon: float, h_obs: float = config.OBSERVER_HEIGHT_M) -> tuple[HorizonResult, str]:
    """Horizon for a site using the real DEMs where available. Returns (result, horizon_source)."""
    from pipeline import dem
    sampler = dem.default_sampler()
    src = dem.horizon_source(lat, lon, sampler)
    if src == "smooth-sphere":
        return smooth_sphere_horizon(h_obs), src
    return compute_horizon(lat, lon, sampler, h_obs), src


def interp_mask(mask_el: np.ndarray, az_deg: np.ndarray) -> np.ndarray:
    """Periodic linear interpolation of a horizon mask (uniform bins from 0°) at arbitrary azimuths."""
    n = len(mask_el)
    x = (np.asarray(az_deg) % 360.0) * (n / 360.0)
    i0 = np.floor(x).astype(int) % n
    f = x - np.floor(x)
    return mask_el[i0] * (1 - f) + mask_el[(i0 + 1) % n] * f
