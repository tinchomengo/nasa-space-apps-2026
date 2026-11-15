"""Data for the video's south-pole flyover (S3): LOLA 120 m terrain with a real low Sun, lighting baked.

Run from the repo root:  .venv/bin/python -m pipeline.export_southpole [--epoch 2027-...]

Grid: a square of ±HALF_KM around the pole in the DEM's own polar-stereographic plane (CRS read from the
file), rotated so that +u points toward the Sun's horizontal direction. Heights come from
LDEM_75S_120M (heights relative to the 1737.4 km sphere).

Lighting, at the real Sun direction for --epoch (DE421 + MOON_ME_DE421):
  - surface z = h - r^2 / (2R): the sphere's curvature around the pole, so the local Sun elevation varies
    across the map as it should;
  - Lambert shading cos(i) from the surface normal;
  - cast shadows: a point is shadowed at Sun elevation e if any point toward the Sun rises above the ray.
    With +u toward the Sun, that is a reverse running maximum of (z - u·tan e) along each row (exact, O(N²));
  - penumbra: 7 elevations across the Sun's 0.53° disc, weighted by the disc's chord lengths.
Writes video/public/data/sp_shade.jpg (grayscale), sp_height.bin (uint16) and sp_meta.json (labels, Sun).
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

from pipeline import config, dem, ephem

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "video" / "public" / "data"
R = config.MOON_RADIUS_M
HALF_KM = 200.0
N_SHADE = 4096
N_MESH = 1024
SUN_R_DEG = 0.267

# Map labels. Crater labels at IAU crater centres; site labels at the app's curated coordinates.
LABELS = [
    ("Shackleton", -89.67, 129.78, "crater, IAU centre"),
    ("Connecting Ridge", -89.4527, -137.1487, "T-Minus site (PGDA 78 Site01 ROI)"),
    ("de Gerlache", -88.5, -87.1, "crater, IAU centre"),
    ("Malapert", -85.9883, 2.0625, "T-Minus site (massif summit)"),
    ("Mons Mouton (IM-2)", -84.7906, 29.1957, "IM-2 landing site (published)"),
    ("Nobile", -85.2, 53.5, "crater, IAU centre"),
]


def sun_at(epoch: datetime):
    """Sun direction at the pole: elevation above the polar tangent plane and its horizontal PS direction."""
    t = ephem.utc_times([epoch])
    v = ephem.body_vectors_me(-90.0, 0.0, 0.0, t, "sun")[0]
    s = v / np.linalg.norm(v)
    el = np.degrees(np.arcsin(-s[2]))  # up at the south pole is -Z
    lon = np.degrees(np.arctan2(s[1], s[0]))  # longitude the Sun is over
    return el, lon


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--epoch", default="2027-02-21T12:00", help="UTC; default: Sun ~1.3° above the pole")
    a = ap.parse_args()
    epoch = datetime.fromisoformat(a.epoch).replace(tzinfo=timezone.utc)
    sun_el, sun_lon = sun_at(epoch)

    far = dem.load_far()
    sampler = dem.TerrainSampler([far])
    # Sun's horizontal direction in the PS plane: project a point near the pole at the Sun's longitude
    px, py = sampler.project(np.array([-89.0]), np.array([sun_lon]))
    uhat = np.array([px[0], py[0]]) / np.hypot(px[0], py[0])
    vhat = np.array([-uhat[1], uhat[0]])

    def grid(n):
        c = (np.arange(n) + 0.5) / n * 2 * HALF_KM * 1000 - HALF_KM * 1000
        U, V = np.meshgrid(c, c)  # rows: v, cols: u (toward the Sun)
        X = U * uhat[0] + V * vhat[0]
        Y = U * uhat[1] + V * vhat[1]
        return c, U, V, X, Y

    c, U, V, X, Y = grid(N_SHADE)
    h = far.sample(X.ravel(), Y.ravel()).reshape(U.shape)
    if np.isnan(h).any():
        h = np.where(np.isnan(h), np.nanmean(h), h)
    z = h - (U ** 2 + V ** 2) / (2 * R)
    step = c[1] - c[0]

    # Lambert term with the curved surface (u toward the Sun)
    dzdv, dzdu = np.gradient(z, step)
    n = np.stack([-dzdu, -dzdv, np.ones_like(z)])
    n /= np.linalg.norm(n, axis=0)
    e0 = np.radians(sun_el)
    cos_i = np.clip(n[0] * np.cos(e0) + n[2] * np.sin(e0), 0, None)

    # Cast shadows with penumbra
    ks = np.linspace(-1, 1, 7)
    w = np.sqrt(np.clip(1 - ks ** 2, 0, None)) + 0.05
    w /= w.sum()
    lit = np.zeros_like(z)
    for k, wk in zip(ks, w):
        e = np.radians(sun_el + k * SUN_R_DEG)
        key = z - U * np.tan(e)
        rev = np.maximum.accumulate(key[:, ::-1], axis=1)[:, ::-1]
        ahead = np.concatenate([rev[:, 1:], np.full((key.shape[0], 1), -np.inf)], axis=1)
        lit += wk * (ahead <= key)
    b = lit * cos_i

    # Tone map (grazing light: most flats are dim; Sun-facing slopes bright) + fine regolith grain
    rng = np.random.default_rng(7)
    grain = rng.normal(0, 1, z.shape).astype(np.float32)
    grain = (grain + np.roll(grain, 1, 0) + np.roll(grain, 1, 1) + np.roll(grain, (1, 1), (0, 1))) / 4
    v = 1 - np.exp(-7.0 * b)
    v = v * (1 + 0.07 * grain) + 0.012
    img = (np.clip(v, 0, 1) ** (1 / 1.15) * 255).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img, "L").save(OUT / "sp_shade.jpg", quality=88)

    # Mesh heights (same grid, coarser), uint16 with scale/offset
    cm, Um, Vm, Xm, Ym = grid(N_MESH)
    hm = far.sample(Xm.ravel(), Ym.ravel()).reshape(Um.shape)
    hm = np.where(np.isnan(hm), np.nanmean(hm), hm)
    lo, hi = float(hm.min()), float(hm.max())
    q = np.round((hm - lo) / (hi - lo) * 65535).astype("<u2")
    (OUT / "sp_height.bin").write_bytes(q.tobytes())

    # Labels in (u, v) km + height
    labels = []
    lat = np.array([l[1] for l in LABELS]); lon = np.array([l[2] for l in LABELS])
    lx, ly = sampler.project(lat, lon)
    lh = far.sample(lx, ly)
    for (name, la, lo_, note), x, y, hh in zip(LABELS, lx, ly, lh):
        u = (x * uhat[0] + y * uhat[1]) / 1000
        vv = (x * vhat[0] + y * vhat[1]) / 1000
        # lit fraction at the label (from the shade grid) for a sanity print
        j = int((u + HALF_KM) / (2 * HALF_KM) * N_SHADE); i = int((vv + HALF_KM) / (2 * HALF_KM) * N_SHADE)
        labels.append({"name": name, "lat": la, "lon": lo_, "note": note, "u_km": round(u, 3), "v_km": round(vv, 3),
                       "h_m": round(float(hh), 1), "lit": round(float(lit[i, j]), 2) if 0 <= i < N_SHADE and 0 <= j < N_SHADE else None})
    meta = {
        "epoch_utc": epoch.strftime("%Y-%m-%dT%H:%MZ"), "sun_el_at_pole_deg": round(float(sun_el), 3),
        "sun_lon_deg": round(float(sun_lon), 2), "half_km": HALF_KM, "n_shade": N_SHADE, "n_mesh": N_MESH,
        "height_lo_m": lo, "height_hi_m": hi, "moon_radius_m": R,
        "frame": "u toward the Sun's horizontal direction, v = u rotated +90° (PS plane of LDEM_75S_120M)",
        "labels": labels,
        "source": "NASA LRO LOLA LDEM_75S_120M_FLOAT; Sun from DE421 + MOON_ME_DE421",
    }
    (OUT / "sp_meta.json").write_text(json.dumps(meta, indent=1))
    print(f"Sun {sun_el:.2f}° above the pole, over lon {sun_lon:.1f}° · heights {lo:.0f}..{hi:.0f} m · "
          f"lit {100 * (lit > 0.5).mean():.0f}% of the map")
    for l in labels:
        print(f"  {l['name']:<20} u {l['u_km']:+8.1f} v {l['v_km']:+8.1f} km  h {l['h_m']:+7.0f} m  lit {l['lit']}")


if __name__ == "__main__":
    main()
