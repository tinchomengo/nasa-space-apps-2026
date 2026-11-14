"""Exports that let the browser compute any point (custom coordinates / Explore mode).

Run from the repo root:  .venv/bin/python -m pipeline.export_browser [--skip-grids]

1. ephem_vectors.bin (+ .json): hourly APPARENT Moon-centre -> Sun and Moon-centre -> Earth vectors
   in MOON_ME_DE421 (km, float32 little-endian, interleaved [sx, sy, sz, ex, ey, ez] per hour).
   The browser subtracts the site's position vector (R + h)·û to get topocentric vectors, so lunar
   parallax (up to ~0.26° for Earth) is exact. Light-time/aberration differences between the Moon's
   centre and a surface point are < 0.0001° (checked by web/test/geo.test.ts against Skyfield).
2. nb_<site>.bin (+ .json): 10 × 10 km neighbourhood around each polar curated site: 21 × 21 points at
   500 m on the polar-stereographic grid, each with a 360-azimuth horizon mask (1° bins, int16
   centidegrees), plus a 100 m relief grid (int16 metres) for the clickable map.
3. web/test/fixtures/geo_ref.json: full-precision Skyfield az/el at curated sites for the JS test.
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone

import numpy as np
from rasterio.warp import transform as warp_transform

from pipeline import config, dem, ephem, horizon
from pipeline.build import _iso
from pipeline.sites import SITES

NB_HALF_M = 5000.0
NB_STEP_M = 500.0
RELIEF_STEP_M = 100.0
NB_AZ = 360


def export_vectors() -> None:
    k = ephem.load_kernels()
    t, unix = ephem.utc_range(_iso(config.SPAN_START), _iso(config.SPAN_END), config.EXPORT_STEP_MIN)
    moon = k.eph["moon"]
    cols = []
    for body in ("sun", "earth"):
        app = moon.at(t).observe(k.eph[body]).apparent()
        cols.append(np.asarray(app.frame_xyz(k.frame).km))  # (3, N)
    arr = np.concatenate(cols, axis=0).T.astype("<f4")  # (N, 6)
    config.WEB_DATA.mkdir(parents=True, exist_ok=True)
    (config.WEB_DATA / "ephem_vectors.bin").write_bytes(arr.tobytes())
    meta = {"t0": int(unix[0]), "stepSec": config.EXPORT_STEP_MIN * 60, "n": int(arr.shape[0]),
            "layout": ["sun_x", "sun_y", "sun_z", "earth_x", "earth_y", "earth_z"], "units": "km",
            "frame": config.MOON_FRAME, "origin": "Moon centre", "apparent": True,
            "moon_radius_km": config.MOON_RADIUS_M / 1000, "sun_radius_km": config.SUN_RADIUS_KM,
            "earth_radius_km": config.EARTH_RADIUS_KM, "observer_height_m": config.OBSERVER_HEIGHT_M}
    (config.WEB_DATA / "ephem_vectors.json").write_text(json.dumps(meta))
    print(f"ephem_vectors.bin {arr.nbytes / 1e3:.0f} kB ({arr.shape[0]} hours)")


def export_fixture() -> None:
    """Skyfield reference az/el (full precision) at curated sites for the browser-math test."""
    sampler = dem.default_sampler()
    t_all, unix_all = ephem.utc_range(_iso(config.SPAN_START), _iso(config.SPAN_END), config.EXPORT_STEP_MIN)
    idx = np.linspace(0, len(unix_all) - 1, 40).astype(int)
    t = t_all[idx]
    out = []
    for s in SITES:
        src = dem.horizon_source(s.lat, s.lon, sampler)
        h_site = 0.0 if src == "smooth-sphere" else float(sampler(np.array([s.lat]), np.array([s.lon]))[0])
        elev = h_site + config.OBSERVER_HEIGHT_M
        rec = {"id": s.id, "lat": s.lat, "lon": s.lon, "elev_m": elev, "t": [int(u) for u in unix_all[idx]]}
        for b in ephem.BODIES:
            r = ephem.topocentric(s.lat, s.lon, elev, t, b)
            rec[f"{b}Az"] = r["az_deg"].tolist()
            rec[f"{b}El"] = r["el_deg"].tolist()
        out.append(rec)
    p = config.ROOT / "web" / "test" / "fixtures" / "geo_ref.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out))
    print(f"fixture {p.relative_to(config.ROOT)} ({len(out)} sites x {len(idx)} times)")


def export_neighbourhood(site) -> None:
    sampler = dem.default_sampler()
    geo = f"+proj=longlat +R={config.MOON_RADIUS_M} +no_defs"
    crs = sampler._crs
    cx, cy = sampler.project(np.array([site.lat]), np.array([site.lon]))
    cx, cy = float(cx[0]), float(cy[0])

    off = np.arange(-NB_HALF_M, NB_HALF_M + 1, NB_STEP_M)
    n = len(off)
    gx, gy = np.meshgrid(cx + off, cy - off)  # row 0 = top (+y), like an image
    lon, lat = warp_transform(crs, geo, gx.ravel(), gy.ravel())
    lat, lon = np.array(lat), np.array(lon)
    hts = sampler(lat, lon)

    t0 = time.perf_counter()
    masks = np.empty((n * n, NB_AZ), dtype="<i2")
    for k in range(n * n):
        hz = horizon.compute_horizon(lat[k], lon[k], sampler, n_az=NB_AZ, site_height_m=float(hts[k]))
        masks[k] = np.round(hz.el_deg * 100).astype("<i2")
    secs = time.perf_counter() - t0

    roff = np.arange(-NB_HALF_M, NB_HALF_M + 1, RELIEF_STEP_M)
    rx, ry = np.meshgrid(cx + roff, cy - roff)
    rlon, rlat = warp_transform(crs, geo, rx.ravel(), ry.ravel())
    relief = sampler(np.array(rlat), np.array(rlon))

    (config.WEB_DATA / f"nb_{site.id}.bin").write_bytes(masks.tobytes())
    meta = {"site": site.id, "centre_ps_m": [cx, cy], "step_m": NB_STEP_M, "n": n, "half_m": NB_HALF_M,
            "n_az": NB_AZ, "mask_units": "centidegrees", "row0": "+y (top)", "crs": sampler.rasters[0].crs_proj4,
            "lat": np.round(lat, 6).tolist(), "lon": np.round(lon, 6).tolist(), "height_m": np.round(hts, 1).tolist(),
            "relief": {"step_m": RELIEF_STEP_M, "n": len(roff), "height_m": np.round(relief).astype(int).tolist()},
            "observer_height_m": config.OBSERVER_HEIGHT_M}
    (config.WEB_DATA / f"nb_{site.id}.json").write_text(json.dumps(meta, separators=(",", ":")))
    print(f"nb_{site.id}: {n}x{n} masks in {secs:.0f}s, {masks.nbytes / 1e3:.0f} kB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-grids", action="store_true")
    args = ap.parse_args()
    export_vectors()
    export_fixture()
    if not args.skip_grids:
        for s in SITES:
            if dem.horizon_source(s.lat, s.lon) != "smooth-sphere":
                export_neighbourhood(s)


if __name__ == "__main__":
    main()
