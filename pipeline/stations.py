"""Ground-station visibility of the Moon (second horizon of the two-horizon link model).

Link possible = Earth's centre above the lunar terrain at the site AND the Moon above the
station's elevation mask (default 10°) at one or more stations.

The Moon's CENTRE is used as the target: the lander's offset from the Moon's centre changes the
Moon elevation seen from Earth by at most ≈0.3° (lunar parallax), which is negligible against a
10° mask. So station visibility is computed once and shared by all sites. No refraction.

Coordinates are approximate antenna positions (sub-km accuracy is irrelevant at a 10° mask).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from skyfield.api import wgs84

from pipeline import config
from pipeline.ephem import load_kernels


@dataclass(frozen=True)
class Station:
    id: str
    name: str
    lat: float
    lon: float
    elev_m: float
    note: str


STATIONS = [
    Station("malargue", "Malargüe DSA-3 (ESA, Argentina)", -35.7760, -69.3983, 1550.0,
            "ESA 35 m deep-space antenna; CONAE coordinates Argentina's share of its time"),
    Station("goldstone", "Goldstone DSS-14 (NASA DSN, USA)", 35.4259, -116.8895, 1002.0, "NASA DSN 70 m"),
    Station("madrid", "Madrid DSS-63 (NASA DSN, Spain)", 40.4313, -4.2481, 865.0, "NASA DSN 70 m"),
    Station("canberra", "Canberra DSS-43 (NASA DSN, Australia)", -35.4023, 148.9813, 689.0, "NASA DSN 70 m"),
]


def moon_elevation(t, station: Station) -> np.ndarray:
    k = load_kernels()
    obs = k.eph["earth"] + wgs84.latlon(station.lat, station.lon, elevation_m=station.elev_m)
    alt, _, _ = obs.at(t).observe(k.eph["moon"]).apparent().altaz()  # no refraction
    return alt.degrees


def all_station_elevations(t) -> dict[str, np.ndarray]:
    return {s.id: moon_elevation(t, s) for s in STATIONS}


def above_mask(el: np.ndarray, mask_deg: float = config.STATION_MASK_DEG) -> np.ndarray:
    return el > mask_deg
