"""Validate our Skyfield ephemeris (DE421 + MOON_ME_DE421) against JPL Horizons.

For several lunar sites, epochs and both bodies, fetch Horizons apparent airless az/el for a
surface observer (CENTER='coord@301') and compare with ephem.topocentric() at the same UTC
instants. Responses are cached in data/horizons_cache/, so after the first run this works offline.

Run from the repo root:  .venv/bin/python -m pipeline.validate_horizons
Writes: docs/VALIDATION.md (Horizons section) and web/public/data/validation.json ("horizons" key).
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import numpy as np

from pipeline import config, ephem
from pipeline.sites import BY_ID

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
BODY_CODE = {"sun": "10", "earth": "399"}

SITE_IDS = ["connecting-ridge", "shackleton-rim", "de-gerlache-rim", "malapert", "mons-mouton",
            "chandrayaan-3", "apollo-11"]
# Each epoch: a 24 h window sampled hourly (25 samples)
EPOCHS = [datetime(2026, 12, 1, tzinfo=timezone.utc),
          datetime(2027, 6, 15, tzinfo=timezone.utc),
          datetime(2028, 9, 1, tzinfo=timezone.utc)]
WINDOW_H, STEP_H = 24, 1
ALT_KM = 0.0  # observer on the 1737.4 km reference sphere, both in Horizons and in Skyfield


def _q(v: str) -> str:
    return f"'{v}'"


def horizons_params(lat: float, lon: float, body: str, start: datetime) -> dict:
    stop = start + timedelta(hours=WINDOW_H)
    return {
        "format": "json",
        "COMMAND": _q(BODY_CODE[body]),
        "OBJ_DATA": _q("NO"),
        "MAKE_EPHEM": _q("YES"),
        "EPHEM_TYPE": _q("OBSERVER"),
        "CENTER": _q("coord@301"),
        "COORD_TYPE": _q("GEODETIC"),
        # east longitude (0..360), latitude, altitude in km
        "SITE_COORD": _q(f"{lon % 360.0:.6f},{lat:.6f},{ALT_KM:.4f}"),
        "START_TIME": _q(start.strftime("%Y-%m-%d %H:%M")),
        "STOP_TIME": _q(stop.strftime("%Y-%m-%d %H:%M")),
        "STEP_SIZE": _q(f"{STEP_H} h"),
        "QUANTITIES": _q("4"),
        "APPARENT": _q("AIRLESS"),
        "ANG_FORMAT": _q("DEG"),
        "EXTRA_PREC": _q("YES"),
        "CSV_FORMAT": _q("YES"),
        "TIME_DIGITS": _q("MINUTES"),
        "CAL_FORMAT": _q("CAL"),
    }


def fetch(params: dict) -> dict:
    """GET Horizons with on-disk cache keyed by the query parameters."""
    config.HORIZONS_CACHE.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:20]
    path = config.HORIZONS_CACHE / f"{key}.json"
    if path.exists():
        return json.loads(path.read_text())
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "tminus-validation/0.1"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode())
            break
        except Exception:  # network hiccup: back off and retry
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    if "result" not in data:
        raise RuntimeError(f"Horizons error: {data}")
    path.write_text(json.dumps({"params": params, **data}))
    time.sleep(0.5)  # be polite
    return data


def parse(result: str) -> tuple[list[datetime], np.ndarray, np.ndarray, dict]:
    """Parse a CSV observer table: returns UTC times, az, el (deg), and header facts."""
    lines = result.splitlines()
    soe = lines.index("$$SOE")
    eoe = lines.index("$$EOE")
    header = [h.strip() for h in lines[soe - 2].split(",")]
    i_az = next(i for i, h in enumerate(header) if h.startswith("Azi"))
    i_el = next(i for i, h in enumerate(header) if h.startswith("Elev"))
    if "UT" not in header[0]:
        raise RuntimeError(f"unexpected time scale column: {header[0]}")
    times, az, el = [], [], []
    for row in lines[soe + 1:eoe]:
        f = [x.strip() for x in row.split(",")]
        times.append(datetime.strptime(f[0], "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc))
        az.append(float(f[i_az]))
        el.append(float(f[i_el]))
    facts = {}
    for ln in lines[:soe]:
        for tag in ("Center body name", "Center pole/equ", "Center radii", "Atmos refraction"):
            if ln.strip().startswith(tag):
                facts[tag] = " ".join(ln.split())
    return times, np.array(az), np.array(el), facts


def wrap180(d):
    return (d + 180.0) % 360.0 - 180.0


def ang_sep(az1, el1, az2, el2):
    """Great-circle separation (deg) between two (az, el) directions."""
    a1, e1, a2, e2 = map(np.radians, (az1, el1, az2, el2))
    c = np.sin(e1) * np.sin(e2) + np.cos(e1) * np.cos(e2) * np.cos(a1 - a2)
    return np.degrees(np.arccos(np.clip(c, -1.0, 1.0)))


def run() -> dict:
    rows, all_daz, all_del, all_sep = [], [], [], []
    facts_seen = {}
    for sid in SITE_IDS:
        s = BY_ID[sid]
        for body in ephem.BODIES:
            daz_l, del_l, sep_l = [], [], []
            for start in EPOCHS:
                data = fetch(horizons_params(s.lat, s.lon, body, start))
                times, h_az, h_el, facts = parse(data["result"])
                facts_seen.update(facts)
                ours = ephem.topocentric(s.lat, s.lon, ALT_KM * 1000.0, ephem.utc_times(times), body)
                daz = wrap180(ours["az_deg"] - h_az)
                d_el = ours["el_deg"] - h_el
                sep = ang_sep(ours["az_deg"], ours["el_deg"], h_az, h_el)
                # azimuth is degenerate near the zenith; exclude from |Δaz| stats (sep still counts)
                daz = np.where(h_el < 85.0, daz, np.nan)
                daz_l.append(daz); del_l.append(d_el); sep_l.append(sep)
            daz, d_el, sep = (np.concatenate(x) for x in (daz_l, del_l, sep_l))
            all_daz.append(daz); all_del.append(d_el); all_sep.append(sep)
            rows.append({
                "site": sid, "name": s.name, "lat": s.lat, "lon": s.lon, "body": body, "n": int(len(sep)),
                "max_abs_daz": float(np.nanmax(np.abs(daz))), "mean_abs_daz": float(np.nanmean(np.abs(daz))),
                "max_abs_del": float(np.max(np.abs(d_el))), "mean_abs_del": float(np.mean(np.abs(d_el))),
                "max_sep": float(np.max(sep)), "mean_sep": float(np.mean(sep)),
            })
    daz, d_el, sep = (np.concatenate(x) for x in (all_daz, all_del, all_sep))

    # Negative controls: the comparison must be able to see small errors. Perturb our input
    # (site longitude, time) and confirm the separation grows well above the baseline.
    s = BY_ID[SITE_IDS[0]]
    times, h_az, h_el, _ = parse(fetch(horizons_params(s.lat, s.lon, "earth", EPOCHS[0]))["result"])
    controls = []
    for label, dlon, dsec in [("baseline", 0.0, 0.0), ("site lon +0.001°", 0.001, 0.0), ("time +10 s", 0.0, 10.0)]:
        tt = ephem.utc_times([x + timedelta(seconds=dsec) for x in times])
        o = ephem.topocentric(s.lat, s.lon + dlon, 0.0, tt, "earth")
        controls.append({"perturbation": label, "site": s.id, "body": "earth",
                         "max_sep": float(np.max(ang_sep(o["az_deg"], o["el_deg"], h_az, h_el)))})

    overall = {
        "n": int(len(sep)),
        "max_abs_daz": float(np.nanmax(np.abs(daz))), "mean_abs_daz": float(np.nanmean(np.abs(daz))),
        "max_abs_del": float(np.max(np.abs(d_el))), "mean_abs_del": float(np.mean(np.abs(d_el))),
        "max_sep": float(np.max(sep)), "mean_sep": float(np.mean(sep)),
    }
    return {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "ours": "Skyfield + DE421 + MOON_ME_DE421 frame (moon_pa_de421_1900-2050.bpc), apparent, no refraction",
        "reference": "JPL Horizons API, observer table, QUANTITIES=4, APPARENT=AIRLESS, CENTER=coord@301 (GEODETIC)",
        "horizons_header": facts_seen,
        "observer_alt_km": ALT_KM,
        "epochs": [f"{e:%Y-%m-%d} +{WINDOW_H} h every {STEP_H} h" for e in EPOCHS],
        "target_deg": 0.05,
        "overall": overall,
        "rows": rows,
        "controls": controls,
    }


def to_markdown(res: dict) -> str:
    o = res["overall"]
    f = lambda x: f"{x * 3600:.3f}″"  # noqa: E731  arcseconds
    md = [
        "## Ephemeris vs JPL Horizons",
        "",
        f"*Generated by `pipeline/validate_horizons.py` on {res['generated_utc']}. Do not edit by hand.*",
        "",
        f"- **Ours:** {res['ours']}.",
        f"- **Reference:** {res['reference']}.",
        f"- **Observer:** on the 1737.4 km reference sphere (alt = {res['observer_alt_km']} km) in both.",
        f"- **Epochs:** {', '.join(res['epochs'])} (UTC). {len(SITE_IDS)} sites × 2 bodies × {o['n'] // (len(SITE_IDS) * 2)} instants = {o['n']} comparisons.",
        "- |Δaz| excludes samples with the body above 85° elevation, where azimuth is degenerate. The angular separation includes all of them.",
        "",
        f"**Overall:** max |Δaz| = {f(o['max_abs_daz'])}, max |Δel| = {f(o['max_abs_del'])}, "
        f"max separation = {f(o['max_sep'])} (mean {f(o['mean_sep'])}). Target was < 0.05° = 180″.",
        "",
        "| Site | Lat | Lon | Body | n | max \\|Δaz\\| | mean \\|Δaz\\| | max \\|Δel\\| | mean \\|Δel\\| | max sep |",
        "|---|---:|---:|---|---:|---:|---:|---:|---:|---:|",
    ]
    for r in res["rows"]:
        md.append(f"| {r['name']} | {r['lat']:.4f} | {r['lon']:.4f} | {r['body']} | {r['n']} | "
                  f"{f(r['max_abs_daz'])} | {f(r['mean_abs_daz'])} | {f(r['max_abs_del'])} | "
                  f"{f(r['mean_abs_del'])} | {f(r['max_sep'])} |")
    md += [
        "",
        "**Sensitivity controls.** These check that the comparison can detect small errors: we perturb *our* input and re-compare against the same Horizons table.",
        "",
        "| Perturbation | Site | Body | max separation |",
        "|---|---|---|---:|",
    ] + [f"| {c['perturbation']} | {c['site']} | {c['body']} | {f(c['max_sep'])} |" for c in res["controls"]]
    md += [
        "",
        "**Reading.** The residual is about 0.04″ (≈ 0.3 m at the lunar surface) and nearly the same at every site and for both bodies. "
        "That pattern fits a tiny constant orientation difference between the DE421 lunar frame (`MOON_ME_DE421`) and Horizons' DE441-based high-precision `MEAN_ME`. "
        "It is about four orders of magnitude below anything that matters for horizon clearance, where one 120 m DEM pixel at 10 km subtends about 0.7°. "
        "The larger |Δaz| at Apollo 11 comes from the Sun passing near the zenith, where small offsets inflate azimuth differences; the angular separation stays at 0.04″.",
    ]
    hdr = res.get("horizons_header", {})
    if hdr:
        md += ["", "Horizons header lines (for provenance):", ""] + [f"- `{v}`" for v in hdr.values()]
    return "\n".join(md) + "\n"


def write_section(md_path, name: str, body: str) -> None:
    """Replace (or append) a marked, generated section in docs/VALIDATION.md."""
    begin, end = f"<!-- BEGIN {name} (generated) -->", f"<!-- END {name} (generated) -->"
    text = md_path.read_text() if md_path.exists() else "# Validation\n\n"
    block = f"{begin}\n{body}{end}\n"
    if begin in text:
        pre, rest = text.split(begin, 1)
        text = pre + block + rest.split(end, 1)[1].lstrip("\n")
    else:
        text = text.rstrip("\n") + "\n\n" + block
    md_path.write_text(text)


def write_json_key(key: str, value: dict) -> None:
    path = config.WEB_DATA / "validation.json"
    data = json.loads(path.read_text()) if path.exists() else {}
    data[key] = value
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1))


def main() -> None:
    res = run()
    md = to_markdown(res)
    write_section(config.ROOT / "docs" / "VALIDATION.md", "horizons", md)
    write_json_key("horizons", res)
    print(md)


if __name__ == "__main__":
    main()
