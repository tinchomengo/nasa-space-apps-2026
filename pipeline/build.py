"""Precompute everything the web app needs -> web/public/data/*.json.

Run from the repo root:  .venv/bin/python -m pipeline.build [--flight-csv]

Outputs (contract with the web app; times are Unix seconds UTC):
- sites.json      list of sites with horizon_source and provenance
- stations.json   hourly Moon elevation per ground station + mask
- site_<id>.json  { meta, horizon[720], hourly{...}, events[], stats{...} }
With --flight-csv: data/flight_csv/<id>.csv (t_utc, earth_az, earth_el, earth_clearance) at
10-min steps, plus the mean Earth azimuth, for the F´ HGA twin (kept outside flight/ for now).
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone

import numpy as np

from pipeline import config, ephem, horizon, metrics, stations
from pipeline.sites import SITES

STEP_S = config.COMPUTE_STEP_MIN * 60
HOURLY_EVERY = config.EXPORT_STEP_MIN // config.COMPUTE_STEP_MIN


def _iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def r2(a, nd=2):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


def write_json(name: str, obj) -> int:
    config.WEB_DATA.mkdir(parents=True, exist_ok=True)
    p = config.WEB_DATA / name
    p.write_text(json.dumps(obj, separators=(",", ":")))
    return p.stat().st_size


def mean_azimuth(az_deg: np.ndarray) -> float:
    return float(np.degrees(np.angle(np.mean(np.exp(1j * np.radians(az_deg))))) % 360.0)


def build_stations(t, unix) -> tuple[dict, np.ndarray, dict[str, np.ndarray]]:
    els = stations.all_station_elevations(t)
    ups = {k: stations.above_mask(v) for k, v in els.items()}
    any_up = np.logical_or.reduce(list(ups.values()))
    out = {
        "meta": {"mask_deg": config.STATION_MASK_DEG, "target": "Moon centre", "refraction": False,
                 "t0": int(unix[0]), "stepSec": STEP_S * HOURLY_EVERY},
        "stations": [{"id": s.id, "name": s.name, "lat": s.lat, "lon": s.lon, "note": s.note,
                      "moonEl": r2(els[s.id][::HOURLY_EVERY], 1),
                      "events": metrics.crossings(els[s.id] - config.STATION_MASK_DEG, unix, "moonrise", "moonset"),
                      "upPct": metrics.pct(ups[s.id])} for s in stations.STATIONS],
        "anyUpPct": metrics.pct(any_up),
    }
    return out, any_up, ups


def build_site(site, t, unix, any_station_up, station_ups, flight_csv: bool) -> tuple[dict, dict]:
    t0 = time.perf_counter()
    hz, src = horizon.site_horizon(site.lat, site.lon)
    elev = hz.site_height_m + config.OBSERVER_HEIGHT_M
    sun = ephem.topocentric(site.lat, site.lon, elev, t, "sun")
    earth = ephem.topocentric(site.lat, site.lon, elev, t, "earth")
    sun_clear = sun["el_deg"] - horizon.interp_mask(hz.el_deg, sun["az_deg"])
    earth_clear = earth["el_deg"] - horizon.interp_mask(hz.el_deg, earth["az_deg"])
    sun_frac = metrics.disc_visible_fraction(sun_clear, sun["ang_radius_deg"])

    # Default Sun definition (>= 50% of disc) => events at Sun-centre crossings
    events = (metrics.crossings(sun_clear, unix, "sunrise", "sunset")
              + metrics.crossings(earth_clear, unix, "earthrise", "earthset"))
    events.sort(key=lambda e: e["t"])
    stats = metrics.window_stats(sun_clear, sun["ang_radius_deg"], earth_clear, earth["ang_radius_deg"],
                                 STEP_S, any_station_up)
    stats["link_pct_by_station"] = {k: metrics.pct((earth_clear > 0) & v) for k, v in station_ups.items()}
    stats["earth_el_range_deg"] = [float(earth["el_deg"].min()), float(earth["el_deg"].max())]
    stats["sun_el_range_deg"] = [float(sun["el_deg"].min()), float(sun["el_deg"].max())]
    mean_earth_az = mean_azimuth(earth["az_deg"])

    sl = slice(None, None, HOURLY_EVERY)
    doc = {
        "meta": {
            "id": site.id, "name": site.name, "lat": site.lat, "lon": site.lon,
            "horizon_source": src, "site_height_m": round(hz.site_height_m, 1),
            "observer_height_m": config.OBSERVER_HEIGHT_M, "span": [config.SPAN_START, config.SPAN_END],
            "compute_step_s": STEP_S, "mean_earth_az_deg": round(mean_earth_az, 2),
            "initial": {"sunUp": bool(sun_clear[0] > 0), "earthUp": bool(earth_clear[0] > 0)},
            "definitions": {"sun": "at least 50% of the disc above the terrain (centre clearance > 0)",
                            "earth": "Earth's centre above the terrain (clearance > 0)"},
            "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        },
        "horizon": r2(hz.el_deg, 3),
        "hourly": {
            "t0": int(unix[0]), "stepSec": STEP_S * HOURLY_EVERY,
            "sunAz": r2(sun["az_deg"][sl]), "sunEl": r2(sun["el_deg"][sl], 3),
            "earthAz": r2(earth["az_deg"][sl]), "earthEl": r2(earth["el_deg"][sl]),
            "sunFrac": r2(sun_frac[sl], 2), "sunClear": r2(sun_clear[sl]), "earthClear": r2(earth_clear[sl]),
        },
        "events": events,
        "stats": stats,
    }
    if flight_csv:
        d = config.DATA / "flight_csv"
        d.mkdir(parents=True, exist_ok=True)
        with open(d / f"{site.id}.csv", "w") as f:
            f.write(f"# site={site.id} mean_earth_az_deg={mean_earth_az:.3f} step_s={STEP_S}\n")
            f.write("t_utc,earth_az,earth_el,earth_clearance\n")
            for u, a, e, c in zip(unix, earth["az_deg"], earth["el_deg"], earth_clear):
                f.write(f"{datetime.fromtimestamp(u, tz=timezone.utc):%Y-%m-%dT%H:%M:%SZ},{a:.3f},{e:.3f},{c:.3f}\n")
    summary = {"id": site.id, "name": site.name, "lat": site.lat, "lon": site.lon, "horizon_source": src,
               "coord_source": site.coord_source, "source": site.source, "why": site.why,
               "tags": list(site.tags), "site_height_m": round(hz.site_height_m, 1),
               "stats": {k: stats[k] for k in ("sunlit_pct", "sunlit_any_part_pct", "sunlit_full_disc_pct",
                                               "earth_visible_pct", "both_pct", "link_pct",
                                               "longest_dark_h", "longest_dte_gap_h")},
               "seconds": round(time.perf_counter() - t0, 2)}
    return doc, summary


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--flight-csv", action="store_true")
    ap.add_argument("--only", nargs="*", help="site ids")
    args = ap.parse_args()

    t_all = time.perf_counter()
    t, unix = ephem.utc_range(_iso(config.SPAN_START), _iso(config.SPAN_END), config.COMPUTE_STEP_MIN)
    st_doc, any_up, ups = build_stations(t, unix)
    print(f"stations.json {write_json('stations.json', st_doc) / 1e3:.0f} kB  any-station-up {st_doc['anyUpPct']:.1f}%")

    summaries = []
    for site in SITES:
        if args.only and site.id not in args.only:
            continue
        doc, summ = build_site(site, t, unix, any_up, ups, args.flight_csv)
        size = write_json(f"site_{site.id}.json", doc)
        summaries.append(summ)
        s = summ["stats"]
        print(f"{site.id:22s} {summ['horizon_source']:13s} {summ['seconds']:5.1f}s {size / 1e6:5.2f} MB  "
              f"sun {s['sunlit_pct']:5.1f}%  earth {s['earth_visible_pct']:5.1f}%  both {s['both_pct']:5.1f}%  "
              f"link {s['link_pct']:5.1f}%  events {len(doc['events'])}")
        if size > 3e6:
            raise SystemExit(f"site_{site.id}.json exceeds 3 MB")
    if not args.only:
        write_json("sites.json", {"generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                                  "observer_height_m": config.OBSERVER_HEIGHT_M,
                                  "span": [config.SPAN_START, config.SPAN_END], "sites": summaries})
    print(f"total {time.perf_counter() - t_all:.1f}s")


if __name__ == "__main__":
    main()
