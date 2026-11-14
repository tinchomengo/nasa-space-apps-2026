"""Compare our long-run Sun / Earth visibility with published values, at the EXACT published points.

Run from the repo root:  .venv/bin/python -m pipeline.validate_published
Writes docs/VALIDATION.md ("published" + "pgda69" sections) and web/public/data/validation.json.

Rules: evaluate at the coordinates given in each paper (never at our display sites); match the
paper's definition (any part / >= 50% / full disc) and period as closely as we can; do NOT tune.
Rows whose paper gives no coordinates are listed as such with no value of ours.
"""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import rasterio
import rasterio.warp

from pipeline import config, dem, ephem, horizon
from pipeline.sites import BY_ID, SITES
from pipeline.validate_horizons import write_json_key, write_section

STEP_MIN = 30  # statistics only
UTC = timezone.utc
NODAL = (datetime(2009, 1, 1, tzinfo=UTC), datetime(2027, 8, 8, tzinfo=UTC))  # one 18.6-yr nodal cycle
BRYANT_SPAN = (datetime(2009, 1, 1, tzinfo=UTC), datetime(2028, 1, 1, tzinfo=UTC))
BRYANT_SRC = "Bryant 2009, IPN PR 42-176, Tables 2-4 (2 m tower; multiyear average)"

# Bryant 2009 Table 2 (lat/lon) and Tables 3-4 (% of time with 0/50/100% of the disc visible).
# Bryant's columns map to ours: (0) = any part, (50) = >= 50% of disc / Earth centre, (100) = full disc.
BRYANT = [  # id, lat, lon, sun(0,50,100), earth(0,50,100)
    ("A1", -89.633, -160.388, (93.46, 90.36, 86.31), (62.20, 55.29, 48.37)),
    ("A2", -89.723, -153.925, (92.98, 89.47, 84.83), (63.90, 56.98, 50.07)),
    ("A3", -89.861, -148.285, (85.36, 80.75, 75.22), (63.41, 56.50, 49.58)),
    ("A4", -89.861, 62.700, (87.83, 83.66, 78.51), (63.97, 57.06, 50.14)),
    ("B1", -89.388, -137.810, (97.01, 94.79, 91.67), (65.16, 58.24, 51.33)),
    ("B3", -89.260, -116.703, (83.84, 80.50, 76.55), (65.60, 58.69, 51.77)),
    ("H", -89.302, 128.371, (77.53, 72.20, 66.57), (62.02, 55.11, 48.20)),
    ("C1", -88.657, -70.688, (90.01, 86.95, 83.12), (70.97, 64.05, 57.14)),
    ("F", -88.813, 126.601, (89.28, 85.97, 81.77), (67.30, 60.38, 53.47)),
    ("MA", -86.037, 1.704, (82.08, 78.36, 74.49), (100.00, 100.00, 94.68)),
    ("LB", -84.722, 39.470, (79.06, 77.43, 75.82), (100.00, 100.00, 100.00)),
]
BRYANT_WHY = ("GSSR radar DEM (40 m, ~5 m vertical, different georeferencing from LOLA; a few-hundred-metre "
              "offset moves a peak point onto a slope) vs LOLA 5/120 m; Bryant assumes a uniform Sun/Earth "
              "distribution inside the libration box, we use the 2009-2028 ephemeris; horizon to 200 km vs 150 km.")

BUSSEY = [  # id, lat, lon, value (% of time illuminated)
    ("A", -89.68, -166.0, 81.0),
    ("B", -89.44, -141.8, 82.0),
    ("D", -88.79, 124.5, 86.0),
]
BUSSEY_SRC = "Bussey et al. 2010, Icarus 208:558 (Kaguya topography; 2020)"
BUSSEY_WHY = ("Kaguya LALT DEM (coarser, older) vs LOLA; coordinates rounded to 0.01-0.1° (~0.3-3 km at the pole); "
              "point and disc definition not re-verified (paper paywalled), so we show all three Sun definitions; "
              "coordinates and values as cited in the project brief.")

NO_COORDS = [
    {"source": "Gläser et al. 2014, Icarus 243:78", "point": "Connecting ridge, best points",
     "metric": "Sun visible, 2 m above ground", "published": 92.27,
     "note": "No coordinates in the accessible text (abstract; full text paywalled)."},
    {"source": "Gläser et al. 2014, Icarus 243:78", "point": "Connecting ridge, best points",
     "metric": "Sun visible, 10 m above ground", "published": 95.65,
     "note": "No coordinates in the accessible text (abstract; full text paywalled)."},
    {"source": "Kumari et al. 2022, PSJ 3:224 (citing Mazarico et al. 2011)", "point": "Artemis Site 007 centre",
     "metric": "Mean solar disc visibility", "published": 85.9,
     "note": "No coordinates published for the site centre (the paper lists only nearby stations)."},
    {"source": "Kumari et al. 2022, PSJ 3:224 (citing Mazarico et al. 2011)", "point": "Artemis Site 011 centre",
     "metric": "Mean solar disc visibility", "published": 82.6,
     "note": "No coordinates published for the site centre (only point L1, which is not where 82.6% applies)."},
    {"source": "Kumari et al. 2022, PSJ 3:224", "point": "Sites 007 / 011 (area)", "metric": "DTE possible",
     "published": 60.0, "note": "Area-level estimate (~60% of the time), no point coordinates."},
]

PGDA69 = {  # 60 m where available (poleward of 85°S), else 120 m
    "sun": ["AVGVISIB_85S_060M_201608", "AVGVISIB_75S_120M_201608"],
    "earth": ["AVGVISIB_85S_060M_201608_EARTH", "AVGVISIB_75S_120M_201608_EARTH"],
}


def ours(lat, lon, span, sampler, h_obs, eph_cache=None, min_dist_m=0.0):
    """Long-run percentages at a point for all disc definitions."""
    d = horizon.ray_distances()
    hz = horizon.compute_horizon(lat, lon, sampler, h_obs=h_obs, dists=d[d >= min_dist_m])
    elev = hz.site_height_m + h_obs
    if eph_cache is None:
        t, _ = ephem.utc_range(*span, STEP_MIN, strict=False)
        eph_cache = {b: ephem.topocentric(lat, lon, elev, t, b) for b in ephem.BODIES}
    out = {"site_height_m": hz.site_height_m}
    for b, tr in eph_cache.items():
        c = tr["el_deg"] - horizon.interp_mask(hz.el_deg, tr["az_deg"])
        r = tr["ang_radius_deg"]
        out[b] = {"any": 100 * np.mean(c > -r), "half": 100 * np.mean(c > 0), "full": 100 * np.mean(c > r)}
    return out, eph_cache


NEARBY_M = 2000.0


def pgda69_sample(lat, lon, products: dict | None = None) -> dict:
    """PGDA 69 value at the point's pixel, plus the best pixel within NEARBY_M (registration test)."""
    out = {}
    for body, names in (products or PGDA69).items():
        for name in names:
            with rasterio.open(config.DATA / "pgda69" / f"{name}.LBL") as ds:
                x, y = rasterio.warp.transform(f"+proj=longlat +R={config.MOON_RADIUS_M} +no_defs", ds.crs, [lon], [lat])
                row, col = ds.index(x[0], y[0])
                r = int(NEARBY_M / ds.res[0]) + 1
                if r <= row < ds.height - r and r <= col < ds.width - r:
                    win = ds.read(1, window=((row - r, row + r + 1), (col - r, col + r + 1))).astype(float)
                    if win[r, r] == ds.nodata:
                        continue
                    win[win == ds.nodata] = np.nan
                    ii, jj = np.mgrid[-r:r + 1, -r:r + 1]
                    win[np.hypot(ii, jj) * ds.res[0] > NEARBY_M] = np.nan
                    cx, cy = ds.xy(row, col)  # pixel centre
                    clon, clat = rasterio.warp.transform(ds.crs, f"+proj=longlat +R={config.MOON_RADIUS_M} +no_defs", [cx], [cy])
                    out[body] = {"value_pct": float(win[r, r] * ds.scales[0] * 100),
                                 "max_nearby_pct": float(np.nanmax(win) * ds.scales[0] * 100),
                                 "product": name, "pixel_centre": (clat[0], clon[0])}
                    break
    return out


def pgda120_pixel_centre(lat, lon):
    far = dem.load_far()
    geo = f"+proj=longlat +R={config.MOON_RADIUS_M} +no_defs"
    x, y = rasterio.warp.transform(geo, far.crs_proj4, [lon], [lat])
    col = np.floor((x[0] - far.c) / far.a); row = np.floor((y[0] - far.f) / far.e)
    cx, cy = far.c + (col + 0.5) * far.a, far.f + (row + 0.5) * far.e
    lo, la = rasterio.warp.transform(far.crs_proj4, geo, [cx], [cy])
    return la[0], lo[0]


def run() -> dict:
    full = dem.default_sampler()
    far_only = dem.TerrainSampler([dem.load_far()])
    rows = []

    for pid, lat, lon, sun_pub, earth_pub in BRYANT:
        o, _ = ours(lat, lon, BRYANT_SPAN, full, config.OBSERVER_HEIGHT_M)
        for body, pub in (("sun", sun_pub), ("earth", earth_pub)):
            for i, (k, defn) in enumerate(zip(("any", "half", "full"), ("any part", ">= 50% disc", "full disc"))):
                rows.append({"source": BRYANT_SRC, "point": f"Bryant {pid}", "lat": lat, "lon": lon,
                             "metric": f"{'Sun' if body == 'sun' else 'Earth'} visible ({defn})", "published": pub[i],
                             "ours": o[body][k], "period": "2009-2028", "h_obs_m": config.OBSERVER_HEIGHT_M,
                             "horizon_source": dem.horizon_source(lat, lon, full), "why": BRYANT_WHY})

    t20 = (datetime(2020, 1, 1, tzinfo=UTC), datetime(2021, 1, 1, tzinfo=UTC))
    for pid, lat, lon, pub in BUSSEY:
        o, _ = ours(lat, lon, t20, full, config.OBSERVER_HEIGHT_M)
        for k, defn in zip(("any", "half", "full"), ("any part", ">= 50% disc", "full disc")):
            rows.append({"source": BUSSEY_SRC, "point": f"Bussey {pid}", "lat": lat, "lon": lon,
                         "metric": f"Sun visible ({defn})", "published": pub, "ours": o["sun"][k],
                         "period": "2020", "h_obs_m": config.OBSERVER_HEIGHT_M,
                         "horizon_source": dem.horizon_source(lat, lon, full), "why": BUSSEY_WHY})

    # PGDA product 69 at every display site and every validation point with coordinates
    pts = [(s.id, s.name, s.lat, s.lon) for s in SITES if s.lat < -75] + \
          [(f"bryant-{p[0]}", f"Bryant {p[0]}", p[1], p[2]) for p in BRYANT] + \
          [(f"bussey-{p[0]}", f"Bussey {p[0]}", p[1], p[2]) for p in BUSSEY]
    pg_rows = []
    for pid, label, lat, lon in pts:
        smp = pgda69_sample(lat, lon)
        if not smp:
            continue
        s120 = pgda69_sample(lat, lon, {"sun": ["AVGVISIB_75S_120M_201608"], "earth": ["AVGVISIB_75S_120M_201608_EARTH"]})
        o, cache = ours(lat, lon, NODAL, full, config.OBSERVER_HEIGHT_M)
        # replication: 120 m DEM only, at the 120 m pixel centre, surface observer, rays from 1 pixel out
        plat, plon = pgda120_pixel_centre(lat, lon)
        rep, _ = ours(plat, plon, NODAL, far_only, 0.0, eph_cache=cache, min_dist_m=120.0)
        pg_rows.append({"id": pid, "point": label, "lat": lat, "lon": lon,
                        "pgda_sun": smp["sun"]["value_pct"], "pgda_earth": smp["earth"]["value_pct"],
                        "pgda_sun_max2km": smp["sun"]["max_nearby_pct"], "pgda_earth_max2km": smp["earth"]["max_nearby_pct"],
                        "pgda_product": smp["sun"]["product"],
                        "ours_sun": o["sun"]["any"], "ours_earth": o["earth"]["any"],
                        "rep_sun": rep["sun"]["any"], "rep_earth": rep["earth"]["any"],
                        "pgda120_sun": s120["sun"]["value_pct"], "pgda120_earth": s120["earth"]["value_pct"]})

    pg_by_point = {r["point"]: r for r in pg_rows}
    for r in rows:
        pg = pg_by_point.get(r["point"])
        if pg and "any part" in r["metric"]:
            body = "sun" if r["metric"].startswith("Sun") else "earth"
            r["pgda_at_point"] = pg[f"pgda_{body}"]
            r["pgda_max2km"] = pg[f"pgda_{body}_max2km"]
    return {
        "generated_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%MZ"),
        "observer_height_m": config.OBSERVER_HEIGHT_M, "step_min": STEP_MIN,
        "rows": rows, "no_coordinates": NO_COORDS, "pgda69": pg_rows,
        "pgda69_note": ("PGDA product 69 (Mazarico et al. 2011 method, LDEM_75S_120M, 18.6-yr cycle): fraction of "
                        "timesteps with ANY part of the disc visible. 'Ours' = our default (5 m + 120 m DEM, 2 m "
                        "observer). 'Replication' = same 120 m DEM only, observer at the surface (0 m), any-part "
                        "definition, evaluated at the nearest 120 m pixel centre with rays starting one pixel out, over "
                        "2009-01-01..2027-08-08 (one nodal cycle; PGDA's exact period is not stated). PGDA's own "
                        "ray-tracing details differ, so this is an approximate replication."),
    }


def explain_published(r: dict) -> str:
    """One-line, rule-based explanation derived from the numbers in the row (no hand-tuned text)."""
    o, pub = r["ours"], r["published"]
    if "pgda_at_point" in r:
        pa, pm = r["pgda_at_point"], r["pgda_max2km"]
        if abs(o - pa) <= 5 and abs(pub - pm) <= 12:
            return (f"Point is off the LOLA peak: NASA PGDA 69 at this exact point gives {pa:.1f} (ours {o:.1f}); "
                    f"its best pixel within 2 km gives {pm:.1f}, close to the published {pub:.1f}. "
                    "Coordinate/DEM registration of the older DEM, not our method.")
        if abs(o - pa) <= 5:
            return f"Ours matches PGDA 69 at this point ({pa:.1f}); the published value comes from a different DEM/method."
        return (f"Ours differs from PGDA 69 at this point ({pa:.1f}) by {o - pa:+.1f}: 2 m observer + 5 m DEM "
                "vs surface + 60 m DEM on steep terrain.")
    if abs(o - pub) <= 5:
        return "Agrees within 5 points."
    return "Same point as the any-part row above; the disc definition shifts both sides similarly."


def explain_pgda(r: dict) -> str:
    d_rep = r["rep_sun"] - r["pgda120_sun"]
    d_ours = r["ours_sun"] - r["pgda_sun"]
    gap = abs(r["pgda_sun"] - r["pgda120_sun"]) + abs(r["pgda_earth"] - r["pgda120_earth"])
    parts = [f"Replication vs PGDA 120 m: Sun {d_rep:+.1f}, Earth {r['rep_earth'] - r['pgda120_earth']:+.1f}."]
    if d_ours > 5:
        parts.append(f"Ours vs PGDA 60 m Sun {d_ours:+.1f}: mostly our 2 m mast clearing near-field slopes (PGDA is at the surface), plus the 5 m DEM; see the Connecting Ridge breakdown.")
    elif d_ours < -5:
        parts.append(f"Ours vs PGDA 60 m Sun {d_ours:+.1f}: lower than PGDA.")
    else:
        parts.append(f"Ours vs PGDA 60 m Sun {d_ours:+.1f}: within 5 points.")
    if gap > 15:
        parts.append(f"PGDA's own 60 m and 120 m maps differ by {gap:.0f} points combined here (steep, resolution-sensitive terrain).")
    return " ".join(parts)


def _med(pairs: list[tuple[float, float]]) -> dict:
    """Median/max |a-b| over pairs, EXCLUDING trivial rows where both values are 0%."""
    keep = [abs(a - b) for a, b in pairs if not (a == 0 and b == 0)]
    return {"median": float(np.median(keep)) if keep else None, "max": float(np.max(keep)) if keep else None,
            "n": len(keep), "excluded_both_zero": len(pairs) - len(keep)}


def summary(res: dict) -> dict:
    pg = res["pgda69"]
    pub = [r for r in pg if r["id"].startswith(("bryant", "bussey"))]
    cur = [r for r in pg if not r["id"].startswith(("bryant", "bussey"))]
    rr = [r for r in res["rows"] if "pgda_max2km" in r]
    return {
        # headline: our method on PGDA's own 120 m DEM vs PGDA 69's 120 m map (all points)
        "method_check": {"sun": _med([(r["rep_sun"], r["pgda120_sun"]) for r in pg]),
                         "earth": _med([(r["rep_earth"], r["pgda120_earth"]) for r in pg])},
        # our default product (5 m + 120 m DEM, 2 m mast) vs PGDA 69 (60 m map, surface), at curated sites
        "curated_vs_pgda": {"sun": _med([(r["ours_sun"], r["pgda_sun"]) for r in cur]),
                            "earth": _med([(r["ours_earth"], r["pgda_earth"]) for r in cur])},
        # same comparison at the Bryant/Bussey published points
        "published_points_vs_pgda": {"sun": _med([(r["ours_sun"], r["pgda_sun"]) for r in pub]),
                                     "earth": _med([(r["ours_earth"], r["pgda_earth"]) for r in pub])},
        # papers: best PGDA pixel within 2 km of each published point vs the published value
        "published_vs_best2km": _med([(r["pgda_max2km"], r["published"]) for r in rr]),
        "n_points": len(pg),
    }


def connecting_ridge_breakdown() -> dict:
    """Why our Connecting Ridge value differs from PGDA 69: change one thing at a time (any-part definition)."""
    s = BY_ID["connecting-ridge"]
    full = dem.default_sampler()
    far = dem.TerrainSampler([dem.load_far()])
    o2, cache = ours(s.lat, s.lon, NODAL, full, 2.0)
    o0, _ = ours(s.lat, s.lon, NODAL, full, 0.0, eph_cache=cache)
    f0, _ = ours(s.lat, s.lon, NODAL, far, 0.0, eph_cache=cache)
    plat, plon = pgda120_pixel_centre(s.lat, s.lon)
    r0, _ = ours(plat, plon, NODAL, far, 0.0, eph_cache=cache, min_dist_m=120.0)
    p60 = pgda69_sample(s.lat, s.lon)
    p120 = pgda69_sample(s.lat, s.lon, {"sun": ["AVGVISIB_75S_120M_201608"], "earth": ["AVGVISIB_75S_120M_201608_EARTH"]})
    from pipeline.ephem import unit_vector_me
    off_m = float(np.arccos(np.clip(unit_vector_me(s.lat, s.lon) @ unit_vector_me(plat, plon), -1, 1)) * config.MOON_RADIUS_M)
    steps = [
        ("NASA PGDA 69, 120 m map (pixel centre, surface)", p120["sun"]["value_pct"], p120["earth"]["value_pct"]),
        ("Ours, same 120 m DEM, pixel centre, 0 m observer", r0["sun"]["any"], r0["earth"]["any"]),
        (f"Ours, 120 m DEM, at the site point ({off_m:.0f} m from the pixel centre), 0 m", f0["sun"]["any"], f0["earth"]["any"]),
        ("Ours, 5 m + 120 m DEM, site point, 0 m", o0["sun"]["any"], o0["earth"]["any"]),
        ("Ours, 5 m + 120 m DEM, site point, 2 m mast (our default)", o2["sun"]["any"], o2["earth"]["any"]),
        ("NASA PGDA 69, 60 m map (for reference)", p60["sun"]["value_pct"], p60["earth"]["value_pct"]),
    ]
    return {"site": s.id, "lat": s.lat, "lon": s.lon, "definition": "any part of the disc", "period": "2009-01-01..2027-08-08",
            "steps": [{"label": a, "sun": b, "earth": c} for a, b, c in steps],
            "reading": (f"Same DEM, same point: our method gives {steps[1][1]:.1f}% Sun vs PGDA's {steps[0][1]:.1f}%. The big change "
                        f"is the observer height: {steps[3][1]:.1f}% at ground level vs {steps[4][1]:.1f}% with a 2 m mast. At ground "
                        "level the site point sits on a ~1.4° slope, and the Sun never rises more than ~1.5° here, so the ground just "
                        "uphill blocks it; a 2 m mast clears that. Earth swings ±7° and barely changes "
                        f"({min(x[2] for x in steps):.0f}-{max(x[2] for x in steps):.0f}%). At ground level, moving {off_m:.0f} m on the "
                        f"120 m surface also changes the Sun value ({steps[1][1]:.0f} -> {steps[2][1]:.0f}%).")}


GLASER = {"source": "Gläser et al. 2014, Icarus 243:78", "ground_pct": 88.0, "two_m_pct": 92.27, "ten_m_pct": 95.65,
          "note": ("Best points on the Connecting Ridge; no coordinates published in the accessible text. 92.27% (2 m) and "
                   "95.65% (10 m) are in the abstract; 88% (ground level) is as cited in our project brief (full text paywalled). "
                   "Consistency check only, not validation.")}


def summary_md(res: dict) -> list[str]:
    sm, f = res["summary"], (lambda x: f"{x:.1f}")
    mc, cv, pp, b2 = sm["method_check"], sm["curated_vs_pgda"], sm["published_points_vs_pgda"], sm["published_vs_best2km"]
    ex = lambda d: f"n={d['n']}" + (f", {d['excluded_both_zero']} rows with both values 0% excluded" if d["excluded_both_zero"] else "")  # noqa: E731
    cr, g = res["connecting_ridge_breakdown"], res["glaser"]
    out = [
        "**Method check (headline).** Our method run on PGDA's own 120 m DEM vs the NASA PGDA 69 120 m map: "
        f"median |Δ| Sun {f(mc['sun']['median'])} pts ({ex(mc['sun'])}), Earth {f(mc['earth']['median'])} pts ({ex(mc['earth'])}).", "",
        "**Our default product vs PGDA 69** (our 5 m DEM + 2 m mast vs PGDA's 60 m map at the surface; these are different "
        "configurations, see the Connecting Ridge breakdown): curated sites Sun "
        f"{f(cv['sun']['median'])} pts ({ex(cv['sun'])}), Earth {f(cv['earth']['median'])} pts ({ex(cv['earth'])}); "
        f"Bryant/Bussey points Sun {f(pp['sun']['median'])} pts ({ex(pp['sun'])}), Earth {f(pp['earth']['median'])} pts ({ex(pp['earth'])}).", "",
        "**Published studies.** Bryant 2009 and Bussey 2010 used older DEMs (2006 GSSR radar, Kaguya), whose coordinates are "
        "shifted by hundreds of metres to a few km relative to LOLA, so their exact coordinates land on different terrain. "
        f"The best PGDA 69 pixel within 2 km of each published point comes within a median of {f(b2['median'])} pts "
        f"(max {f(b2['max'])}, {ex(b2)}).", "",
        f"**Connecting Ridge breakdown** ({cr['definition']}, {cr['period']}):", "",
        "| Configuration | Sun % | Earth % |", "|---|---:|---:|",
        *[f"| {st['label']} | {f(st['sun'])} | {f(st['earth'])} |" for st in cr["steps"]], "",
        cr["reading"], "",
        f"**Consistency (not validation): {g['source']}.** Best ridge points: {g['ground_pct']:.0f}% at ground level, "
        f"{g['two_m_pct']}% at 2 m, {g['ten_m_pct']}% at 10 m. Ours at the Connecting Ridge display point, 2 m mast: "
        f"{f(cr['steps'][4]['sun'])}% (different point; ours at ground level is lower because our point sits on a slope, "
        f"not on a local top). {g['note']}",
    ]
    return out


def to_markdown(res: dict) -> str:
    f = lambda x: f"{x:.1f}"  # noqa: E731
    md = ["## Long-run visibility vs published values", "",
          f"*Generated by `pipeline/validate_published.py` on {res['generated_utc']}. Do not edit by hand.*", "",
          "Every row is evaluated at the **exact coordinates given in the paper**, not at our display sites, "
          f"with a {res['observer_height_m']:.0f} m observer, {res['step_min']}-min sampling and the paper's period where it is stated. "
          "Differences are expected; we **did not tune** anything to match. Δ = ours − published, in percentage points.", "",
          *summary_md(res), ""]
    by_src: dict[str, list] = {}
    for r in res["rows"]:
        by_src.setdefault(r["source"], []).append(r)
    for src, rows in by_src.items():
        md += [f"### {src}", "", f"*Why they differ:* {rows[0]['why']}", "",
               "| Point | Lat | Lon | Horizon | Metric | Published % | Ours % | Δ | PGDA 69 at point | PGDA 69 best ≤2 km | Explanation |",
               "|---|---:|---:|---|---|---:|---:|---:|---:|---:|---|"]
        for r in rows:
            pa = f(r["pgda_at_point"]) if "pgda_at_point" in r else "—"
            pm = f(r["pgda_max2km"]) if "pgda_max2km" in r else "—"
            md.append(f"| {r['point']} | {r['lat']:.3f} | {r['lon']:.3f} | {r['horizon_source']} | {r['metric']} | "
                      f"{f(r['published'])} | {f(r['ours'])} | {r['ours'] - r['published']:+.1f} | {pa} | {pm} | "
                      f"{explain_published(r)} |")
        md.append("")
    md += ["### Published values without usable coordinates", "",
           "| Source | Point | Metric | Published % | Status |", "|---|---|---|---:|---|"]
    for r in res["no_coordinates"]:
        md.append(f"| {r['source']} | {r['point']} | {r['metric']} | {f(r['published'])} | no coordinates published — {r['note']} |")
    md += ["", "### NASA PGDA product 69 (average Sun / Earth visibility maps), sampled at every point", "",
           res["pgda69_note"], "",
           "| Point | Lat | Lon | PGDA product | PGDA Sun % | Ours Sun % | PGDA 120 m Sun % | Replication Sun % | PGDA Earth % | Ours Earth % | PGDA 120 m Earth % | Replication Earth % | Explanation |",
           "|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|"]
    for r in res["pgda69"]:
        md.append(f"| {r['point']} | {r['lat']:.4f} | {r['lon']:.4f} | {r['pgda_product']} | {f(r['pgda_sun'])} | "
                  f"{f(r['ours_sun'])} | {f(r['pgda120_sun'])} | {f(r['rep_sun'])} | {f(r['pgda_earth'])} | "
                  f"{f(r['ours_earth'])} | {f(r['pgda120_earth'])} | {f(r['rep_earth'])} | {explain_pgda(r)} |")
    md += ["", "Our joint \"Sun **and** Earth\" metric has no published reference, so it is not validated here."]
    return "\n".join(md) + "\n"


def main() -> None:
    res = run()
    res["summary"] = summary(res)
    res["connecting_ridge_breakdown"] = connecting_ridge_breakdown()
    res["glaser"] = GLASER
    md = to_markdown(res)
    write_section(config.ROOT / "docs" / "VALIDATION.md", "published", md)
    write_json_key("published", res)
    print(md)


if __name__ == "__main__":
    main()
