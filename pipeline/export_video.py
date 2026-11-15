"""Data for the video's ridge scene (S1) and the antenna prototype: real Earthset/Earthrise events.

Run from the repo root:  .venv/bin/python -m pipeline.export_video

Writes:
  video/public/data/s1_<name>.json  per window: horizon layers + samples every STEP_MIN minutes
      (Sun/Earth az/el, Earth distance and clearance, Moon elevation at each ground station,
      Earth's body-fixed axes in the site's local east/north/up frame for a true-orientation globe)
  video/EVENTS.md                    every Connecting Ridge Earth event in 2027 with Earth phase,
      Sun elevation and station elevations, so the shots use real, checkable events.

Same ephemeris, frame, horizon and station code as the app (pipeline.ephem / horizon / stations).
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from skyfield.framelib import itrs

from pipeline import config, dem, ephem, horizon, stations
from pipeline.sites import SITES

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "video" / "public" / "data"
SITE_ID = "connecting-ridge"
STEP_MIN = 2
BANDS_KM = ((0, 1), (1, 5), (5, 15), (15, 40), (40, 80), (80, config.HORIZON_MAX_RANGE_M / 1000))  # near -> far
MASK = config.STATION_MASK_DEG

# Windows: one continuous span covering the chosen Earthset (2027-03-19) and the next Earthrise
# (2027-04-01) so the live/HW mode can play set -> rise; plus an alternative full-Earth Earthset.
WINDOWS = {
    "mar2027": ("2027-03-17T00:00:00", "2027-04-03T00:00:00"),
    "mar2027a": ("2027-03-04T00:00:00", "2027-03-06T12:00:00"),
    "aug2027": ("2027-07-31T00:00:00", "2027-08-04T00:00:00"),
}
# earthset + earthrise: the antenna cycle (set -> next rise). earthrise_shot: the S1 LINK ✓ shot, where
# Malargüe has the Moon at 52° and climbing, so the link stays true for ~8 h after Earthrise.
CHOSEN = {"earthset": "2027-03-19T17:07", "earthrise": "2027-04-01T17:35", "alt_earthset": "2027-08-02T17:03",
          "earthrise_shot": "2027-03-05T12:17"}


def _utc(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def _r(a, nd):
    return [round(float(x), nd) for x in np.asarray(a).ravel()]


def site_and_layers():
    site = next(s for s in SITES if s.id == SITE_ID)
    sampler = dem.default_sampler()
    full = horizon.compute_horizon(site.lat, site.lon, sampler)
    dists = horizon.ray_distances()
    layers = []  # per distance band: the highest terrain angle within that band only (one ridgeline per band)
    for a, b in BANDS_KM:
        d = dists[(dists > a * 1000) & (dists <= b * 1000 + 1e-6)]
        h = horizon.compute_horizon(site.lat, site.lon, sampler, dists=d, site_height_m=full.site_height_m)
        layers.append({"km": [a, b], "el": _r(h.el_deg, 3), "dist_m": _r(np.nan_to_num(h.dist_m, nan=0), 0)})
    return site, full, layers


def earth_axes_enu(t, lat, lon):
    """ITRS X, Y, Z axes of the Earth expressed in the site's (east, north, up) frame. Shape (N, 3, 3)."""
    k = ephem.load_kernels()
    R = itrs.rotation_at(t)            # r_itrs = R @ r_icrs  -> rows are ITRS axes in ICRS
    M = k.frame.rotation_at(t)         # r_me   = M @ r_icrs
    R = np.moveaxis(np.atleast_3d(R), -1, 0)
    M = np.moveaxis(np.atleast_3d(M), -1, 0)
    e, n, u = ephem.enu_basis(lat, lon)
    B = np.stack([e, n, u])            # me -> enu
    ax_me = np.einsum("nij,nkj->nki", M, R)  # (N, axis k, me comp)
    return np.einsum("ij,nkj->nki", B, ax_me)  # (N, axis k, enu comp)


def sub_site_latlon(t, lat, lon, elev):
    """Point on Earth directly below the lunar site (sanity check of the globe orientation)."""
    k = ephem.load_kernels()
    v = (ephem.site_topos(lat, lon, elev).at(t).position.km - k.eph["earth"].at(t).position.km)
    R = itrs.rotation_at(t)
    w = np.einsum("ij...,j...->i...", R, v)
    return np.degrees(np.arcsin(w[2] / np.linalg.norm(w, axis=0))), np.degrees(np.arctan2(w[1], w[0]))


def earth_lit_fraction(sun_az, sun_el, earth_az, earth_el):
    def vec(az, el):
        az, el = np.radians(az), np.radians(el)
        return np.stack([np.cos(el) * np.sin(az), np.cos(el) * np.cos(az), np.sin(el)], -1)
    elong = np.arccos(np.clip(np.sum(vec(sun_az, sun_el) * vec(earth_az, earth_el), -1), -1, 1))
    return (1 - np.cos(elong)) / 2  # phase angle ≈ 180° − elongation (Sun-Moon-Earth)


def export_window(name, start, end, site, full, layers):
    elev = full.site_height_m + config.OBSERVER_HEIGHT_M
    t, unix = ephem.utc_range(_utc(start), _utc(end), STEP_MIN)
    sun = ephem.topocentric(site.lat, site.lon, elev, t, "sun")
    earth = ephem.topocentric(site.lat, site.lon, elev, t, "earth")
    earth_clear = earth["el_deg"] - horizon.interp_mask(full.el_deg, earth["az_deg"])
    sun_clear = sun["el_deg"] - horizon.interp_mask(full.el_deg, sun["az_deg"])
    st = stations.all_station_elevations(t)
    axes = earth_axes_enu(t, site.lat, site.lon)
    events = []
    for kind, (a, b) in (("earth", ("earthrise", "earthset")), ("sun", ("sunrise", "sunset"))):
        c = earth_clear if kind == "earth" else sun_clear
        events += [e for e in _crossings(c, unix, a, b)]
    events.sort(key=lambda e: e["t"])
    doc = {
        "meta": {
            "site": site.id, "name": site.name, "lat": site.lat, "lon": site.lon,
            "site_height_m": round(full.site_height_m, 1), "observer_height_m": config.OBSERVER_HEIGHT_M,
            "t0": int(unix[0]), "stepSec": STEP_MIN * 60, "n": len(unix), "station_mask_deg": MASK,
            "stations": [{"id": s.id, "name": s.name} for s in stations.STATIONS],
            "earth_radius_km": config.EARTH_RADIUS_KM, "sun_radius_km": config.SUN_RADIUS_KM,
            "chosen": CHOSEN,
            "note": "Real ephemeris (DE421, MOON_ME_DE421, no refraction). Horizon from LOLA 5 m + 120 m. "
                    "earthAxes: ITRS X,Y,Z axes in local (east, north, up), 9 numbers per sample.",
            "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        },
        "horizon": {"az_step_deg": 360 / len(full.el_deg), "full": _r(full.el_deg, 3), "layers": layers},
        "events": events,
        "s": {
            "sunAz": _r(sun["az_deg"], 3), "sunEl": _r(sun["el_deg"], 4),
            "earthAz": _r(earth["az_deg"], 4), "earthEl": _r(earth["el_deg"], 4),
            "earthDistKm": _r(earth["dist_km"], 0), "earthClear": _r(earth_clear, 4), "sunClear": _r(sun_clear, 4),
            "stationEl": {k: _r(v, 2) for k, v in st.items()},
            "earthAxes": _r(axes.reshape(len(unix), 9), 5),
        },
    }
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"s1_{name}.json"
    p.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"{p.relative_to(ROOT)}: {p.stat().st_size / 1e6:.2f} MB, {len(unix)} samples, {len(events)} events")
    return doc


def _crossings(clear, unix, rise, set_):
    out = []
    s = np.sign(clear)
    for i in np.nonzero(s[:-1] != s[1:])[0]:
        f = clear[i] / (clear[i] - clear[i + 1])
        out.append({"type": rise if clear[i + 1] > 0 else set_, "t": int(round(unix[i] + f * (unix[i + 1] - unix[i])))})
    return out


def events_md(site, full):
    """All Earth events at the site in 2027 with phase, Sun and stations (minute precision)."""
    elev = full.site_height_m + config.OBSERVER_HEIGHT_M
    t, unix = ephem.utc_range(_utc("2027-01-01T00:00:00"), _utc("2028-01-01T00:00:00"), 10)
    earth = ephem.topocentric(site.lat, site.lon, elev, t, "earth")
    ec = earth["el_deg"] - horizon.interp_mask(full.el_deg, earth["az_deg"])
    evs = _crossings(ec, unix, "earthrise", "earthset")
    times = [datetime.fromtimestamp(round(e["t"] / 60) * 60, tz=timezone.utc) for e in evs]
    T = ephem.utc_times(times)
    # station state: just before an Earthset (link being lost) / just after an Earthrise
    Tl = ephem.utc_times([d + timedelta(minutes=(-2 if e["type"] == "earthset" else 2)) for d, e in zip(times, evs)])
    sun = ephem.topocentric(site.lat, site.lon, elev, T, "sun")
    ea = ephem.topocentric(site.lat, site.lon, elev, T, "earth")
    lit = earth_lit_fraction(sun["az_deg"], sun["el_deg"], ea["az_deg"], ea["el_deg"])
    st = stations.all_station_elevations(Tl)
    sub_lat, sub_lon = sub_site_latlon(T, site.lat, site.lon, elev)
    chosen = {v: k for k, v in CHOSEN.items()}
    rows = []
    for i, (d, e) in enumerate(zip(times, evs)):
        up = [s.id for s in stations.STATIONS if st[s.id][i] > MASK]
        tag = chosen.get(d.strftime("%Y-%m-%dT%H:%M"), "")
        rows.append(
            f"| {d:%Y-%m-%d %H:%M} | {e['type']} | {ea['az_deg'][i]:.1f}° | {100 * lit[i]:.0f}% | {sun['el_deg'][i]:+.2f}° | "
            + " | ".join(f"{st[s.id][i]:+.0f}°" for s in stations.STATIONS)
            + f" | {'✓ ' + ', '.join(up) if up else '✗'} | {sub_lat[i]:+.0f}°, {sub_lon[i]:+.0f}° | {('**' + tag + '**') if tag else ''} |")
    head = ("| UTC | Event | Earth az | Earth lit | Sun el | " + " | ".join(s.id.capitalize() for s in stations.STATIONS)
            + " | Link (Moon > 10°) | Sub-site point on Earth | Shot |\n|" + "---|" * (8 + len(stations.STATIONS)) + "\n")
    md = f"""# Video events: real Earthsets and Earthrises at {site.name}

Generated by `pipeline/export_video.py`. Don't edit by hand.

- **Site:** {site.name}, {site.lat:.4f}°, {site.lon:.4f}°.
- **Observer:** {config.OBSERVER_HEIGHT_M:.0f} m above the LOLA surface.
- **Horizon:** 5 m + 120 m DEM.
- **Events:** Earth's centre crossing the terrain horizon, from a 10-minute grid interpolated to the minute.
- **Earth lit:** the illuminated fraction of Earth's disc as seen from the site (100% = full Earth).
- **Station columns:** the Moon's elevation at each ground station, 2 min before an Earthset or 2 min after an Earthrise.
- **Link:** the stations with the Moon above the {MASK:.0f}° mask, so a link was being lost (Earthset) or is available (Earthrise).
- **Sub-site point:** where on Earth the lunar site is overhead. It shows which side of the globe faces the camera, and is a sanity check of the rendered Earth's rotation.

## Chosen shots

| Shot | Event (UTC) | Notes |
|---|---|---|
| Earthset (0:00 hook) | 2027-03-19 17:07 | Owner's choice. Madrid has the Moon at 19° until Earth sets, so SIGNAL LOST is true. Earth is a thin crescent and the Sun is below the horizon, so the ridge is dark. |
| Earthrise, S1 LINK ✓ shot (0:23, 2:46) | 2027-03-05 12:17 | Malargüe has the Moon at 52° and climbing (to 70°), above 10° for about 8 h after Earthrise, so LINK ✓ MALARGÜE is true for the whole clip. Earth is 92% lit. |
| Earthrise, antenna cycle (Act 4) | 2027-04-01 17:35 | The next Earthrise after the 03-19 Earthset. Malargüe (25°, setting), Goldstone and Canberra see the Moon. |
| Alternative Earthset | 2027-08-02 17:03 | Full Earth. The Sun is just above the horizon behind the camera, lighting the ridge. Malargüe has the Moon at 37° until Earth sets. |

## All Earth events in 2027

{head}""" + "\n".join(rows) + "\n"
    p = ROOT / "video" / "EVENTS.md"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(md)
    print(f"{p.relative_to(ROOT)}: {len(rows)} events")


def main() -> None:
    site, full, layers = site_and_layers()
    print(f"site height {full.site_height_m:.1f} m; layers: " + ", ".join(
        f"{l['km'][0]:g}-{l['km'][1]:g} km max {max(l['el']):.2f}°" for l in layers))
    for name, (a, b) in WINDOWS.items():
        export_window(name, a, b, site, full, layers)
    events_md(site, full)


if __name__ == "__main__":
    main()
