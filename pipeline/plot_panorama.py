"""Plausibility plot: terrain horizon + Sun/Earth tracks for one site over a ±14-day window.

Run: .venv/bin/python -m pipeline.plot_panorama connecting-ridge 2027-03-12
Writes docs/img/<site>-panorama.png
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from pipeline import config, ephem, horizon  # noqa: E402
from pipeline.sites import BY_ID  # noqa: E402

# Validated with the dataviz palette checker on the dark surface (CVD ΔE ≥ 26, contrast ≥ 3:1)
BG, INK, MUTED, GRID = "#0b0d12", "#e8ecf3", "#9aa3b2", "#262b35"
SUN, EARTH, TERRAIN, TERRAIN_EDGE = "#bf830b", "#3a7bd5", "#2a2f39", "#6b7280"


def _split_wrap(az, el):
    """Break a polyline where azimuth wraps 360 -> 0 so it isn't drawn across the plot."""
    az = az.copy(); el = el.copy()
    jump = np.abs(np.diff(az)) > 180
    az = np.insert(az, np.flatnonzero(jump) + 1, np.nan)
    el = np.insert(el, np.flatnonzero(jump) + 1, np.nan)
    return az, el


def main(site_id: str = "connecting-ridge", epoch: str = "2027-03-12") -> None:
    s = BY_ID[site_id]
    hz, src = horizon.site_horizon(s.lat, s.lon)
    t_mid = datetime.fromisoformat(epoch).replace(tzinfo=timezone.utc)
    t, _ = ephem.utc_range(t_mid - timedelta(days=14), t_mid + timedelta(days=14), 30)
    elev = hz.site_height_m + config.OBSERVER_HEIGHT_M
    tracks = {b: ephem.topocentric(s.lat, s.lon, elev, t, b) for b in ephem.BODIES}

    fig, ax = plt.subplots(figsize=(14, 4.6), dpi=150)
    fig.patch.set_facecolor(BG); ax.set_facecolor(BG)
    az = np.append(hz.az_deg, 360.0); el = np.append(hz.el_deg, hz.el_deg[0])
    ymin = min(el.min(), min(tr["el_deg"].min() for tr in tracks.values())) - 0.5
    ymax = max(el.max(), max(tr["el_deg"].max() for tr in tracks.values())) + 0.8
    ax.fill_between(az, ymin, el, color=TERRAIN, lw=0, zorder=2)
    ax.plot(az, el, color=TERRAIN_EDGE, lw=1.2, zorder=3, label="Terrain horizon (LOLA)")
    ax.axhline(0, color=MUTED, lw=0.8, ls=(0, (2, 3)), zorder=1)
    ax.text(180, 0.08, "0° local horizontal", color=MUTED, fontsize=8, va="bottom", ha="center")

    for body, color, label in (("sun", SUN, "Sun centre"), ("earth", EARTH, "Earth centre")):
        tr = tracks[body]
        clear = tr["el_deg"] - horizon.interp_mask(hz.el_deg, tr["az_deg"])
        a, e = _split_wrap(tr["az_deg"], tr["el_deg"])
        ax.plot(a, e, color=color, lw=1.0, alpha=0.35, zorder=4)  # full track (faint = behind terrain)
        vis_e = np.where(clear > 0, tr["el_deg"], np.nan)
        a2, e2 = _split_wrap(tr["az_deg"], vis_e)
        ax.plot(a2, e2, color=color, lw=2.0, zorder=5, label=f"{label} (solid = above terrain)")
        i = int(np.nanargmax(tr["el_deg"]))
        ax.annotate(label.split()[0], (tr["az_deg"][i], tr["el_deg"][i]), xytext=(4, 6),
                    textcoords="offset points", color=INK, fontsize=9, fontweight="bold")

    ax.set_xlim(0, 360); ax.set_ylim(ymin, ymax)
    ax.set_xticks(np.arange(0, 361, 45))
    ax.set_xticklabels(["N", "45", "E", "135", "S", "225", "W", "315", "N"])
    ax.grid(True, color=GRID, lw=0.6, zorder=0)
    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.tick_params(colors=MUTED, labelsize=9)
    ax.set_xlabel("Azimuth (°, clockwise from local north)", color=MUTED, fontsize=9)
    ax.set_ylabel("Elevation (°)", color=MUTED, fontsize=9)
    # vertical exaggeration: degrees per inch on each axis
    bbox = ax.get_window_extent().transformed(fig.dpi_scale_trans.inverted())
    vex = (360.0 / bbox.width) / ((ymax - ymin) / bbox.height)
    ax.set_title(f"{s.name}  ({s.lat:.4f}°, {s.lon:.4f}°)  ·  {epoch} ±14 d  ·  horizon: {src}, "
                 f"observer {config.OBSERVER_HEIGHT_M:.0f} m above terrain  ·  vertical exaggeration ≈ {vex:.0f}×",
                 color=INK, fontsize=10, loc="left")
    leg = ax.legend(loc="upper right", fontsize=8, frameon=False, labelcolor=INK)
    fig.tight_layout()
    out = config.ROOT / "docs" / "img" / f"{site_id}-panorama.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=BG)
    print(f"wrote {out}  (horizon {hz.seconds:.2f}s, source {src})")


if __name__ == "__main__":
    main(*sys.argv[1:])
