"""Shared by hw_antenna.py and horizon_ring.py: the same data and the same display mapping.

Data: video/public/data/s1_mar2027.json (exactly what the S1 render shows), Connecting Ridge,
2-min samples of Earth az/el/clearance; events 2027-03-19 Earthset -> 2027-04-01 Earthrise.

Display mapping (prototype, labelled on the device and in the video: "elevación ×6 · azimut ×3"):
    mount_az = clamp(AZ_SCALE * wrap(earth_az - mean_az), ±AZ_LIMIT)
    mount_el = clamp(EL_OFFSET + EL_SCALE * earth_el, 0, 90)
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "public" / "data" / "s1_mar2027.json"
EL_OFFSET, EL_SCALE = 45.0, 6.0
AZ_SCALE, AZ_LIMIT = 3.0, 85.0
# Time map for the set -> rise replay (same defaults as the S1 'cycle' shot in video/src/main.js):
# thirds of the duration for [2 days before Earthset .. Earthset + 3 h], the hidden stretch, and
# [Earthrise - 3 h .. 2 days after]. Piecewise-linear, so the setting and rising play at ~6 h/s
# while the 13 hidden days are fast-forwarded.
PRE_DAYS, POST_DAYS, EDGE_H = 2.0, 2.0, 3.0


def wrap180(a: float) -> float:
    return (a + 180.0) % 360.0 - 180.0


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


@dataclass
class Track:
    t0: float
    step: float
    az: list[float]
    el: list[float]
    clear: list[float]
    mask: list[float]          # terrain horizon, 0.5° bins from north
    mean_az: float
    t_set: float
    t_rise: float
    meta: dict

    def at(self, t: float) -> tuple[float, float, float]:
        x = clamp((t - self.t0) / self.step, 0, len(self.az) - 1.0001)
        i = int(x)
        f = x - i
        lerp = lambda a: a[i] + (a[i + 1] - a[i]) * f
        az = (self.az[i] + wrap180(self.az[i + 1] - self.az[i]) * f) % 360
        return az, lerp(self.el), lerp(self.clear)

    def mask_at(self, az: float) -> float:
        n = len(self.mask)
        x = (az % 360) / (360 / n)
        i = int(x) % n
        f = x - int(x)
        return self.mask[i] + (self.mask[(i + 1) % n] - self.mask[i]) * f

    def knots(self, duration: float) -> list[tuple[float, float]]:
        d = duration / 3
        return [(0.0, self.t_set - PRE_DAYS * 86400), (d, self.t_set + EDGE_H * 3600),
                (2 * d, self.t_rise - EDGE_H * 3600), (duration, self.t_rise + POST_DAYS * 86400)]


def interp(knots, x: float, inverse: bool = False) -> float:
    pts = [(b, a) for a, b in knots] if inverse else knots
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def _event(doc, kind: str, iso_min: str) -> float:
    target = datetime.fromisoformat(iso_min).replace(tzinfo=timezone.utc).timestamp()
    return min((e["t"] for e in doc["events"] if e["type"] == kind), key=lambda t: abs(t - target))


def load(path: Path = DATA) -> Track:
    doc = json.loads(path.read_text())
    m, s = doc["meta"], doc["s"]
    az = s["earthAz"]
    sx = sum(math.sin(math.radians(a)) for a in az)
    cx = sum(math.cos(math.radians(a)) for a in az)
    mean_az = math.degrees(math.atan2(sx, cx)) % 360
    return Track(m["t0"], m["stepSec"], az, s["earthEl"], s["earthClear"], doc["horizon"]["full"], mean_az,
                 _event(doc, "earthset", m["chosen"]["earthset"]), _event(doc, "earthrise", m["chosen"]["earthrise"]), m)


def mount_az(earth_az: float, mean_az: float) -> float:
    return clamp(AZ_SCALE * wrap180(earth_az - mean_az), -AZ_LIMIT, AZ_LIMIT)


def mount_el(earth_el: float) -> float:
    return clamp(EL_OFFSET + EL_SCALE * earth_el, 0.0, 90.0)


def utc(t: float) -> str:
    return datetime.fromtimestamp(round(t / 60) * 60, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
