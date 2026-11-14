"""LOLA DEM loading and bilinear sampling.

Near field: PGDA product 78 5 m/px site tiles (heights in metres; README: polar stereographic,
MOON_ME DE421, pixel-registered). All seven tiles are mosaicked, so a ray from one site that
crosses another site's tile uses 5 m data there too.
Far field: LOLA GDR LDEM_75S_120M_FLOAT (label: heights in KILOMETRES relative to a 1737.4 km
sphere; GDAL reports that sphere as the band offset, which we deliberately do NOT add).

Projection parameters are always read from each file's CRS (never hard-coded). Heights are
returned in metres above the 1737.4 km reference sphere. The near-vs-far consistency test in
tests/test_dem.py checks that both products share that reference and georeferencing.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import rasterio
from rasterio.warp import transform as warp_transform

from pipeline import config

HORIZON_SOURCES = ("5m+120m", "120m", "smooth-sphere")


@dataclass
class Raster:
    name: str
    data: np.ndarray  # float32 heights in metres above the reference sphere, NaN = no data
    a: float  # affine: x = c + col * a ; y = f + row * e   (no rotation terms)
    c: float
    e: float
    f: float
    crs_proj4: str  # PROJ definition read from the file (WKT names differ between products)
    radius_m: float

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        h, w = self.data.shape
        x0, x1 = self.c, self.c + w * self.a
        y0, y1 = self.f + h * self.e, self.f
        return min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)

    def sample(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        """Bilinear interpolation between pixel centres; NaN outside or where any corner is NaN."""
        col = (x - self.c) / self.a - 0.5
        row = (y - self.f) / self.e - 0.5
        h, w = self.data.shape
        j0 = np.floor(col).astype(np.int64)
        i0 = np.floor(row).astype(np.int64)
        ok = (i0 >= 0) & (i0 < h - 1) & (j0 >= 0) & (j0 < w - 1)
        out = np.full(x.shape, np.nan, dtype=np.float64)
        if not ok.any():
            return out
        i, j = i0[ok], j0[ok]
        fx, fy = col[ok] - j, row[ok] - i
        d = self.data
        v = (d[i, j] * (1 - fx) * (1 - fy) + d[i, j + 1] * fx * (1 - fy)
             + d[i + 1, j] * (1 - fx) * fy + d[i + 1, j + 1] * fx * fy)
        out[ok] = v
        return out


def _sphere_radius(crs) -> float:
    m = re.search(r"\+R=([0-9.]+)", crs.to_proj4())
    if not m:
        raise ValueError(f"expected a spherical CRS, got {crs.to_proj4()}")
    return float(m.group(1))


def _from_dataset(ds, name: str, data_m: np.ndarray) -> Raster:
    t = ds.transform
    if t.b != 0 or t.d != 0:
        raise ValueError(f"{name}: rotated geotransform not supported")
    radius = _sphere_radius(ds.crs)
    if abs(radius - config.MOON_RADIUS_M) > 1e-6:
        raise ValueError(f"{name}: CRS sphere {radius} m != {config.MOON_RADIUS_M} m")
    return Raster(name, data_m, t.a, t.c, t.e, t.f, ds.crs.to_proj4(), radius)


def _far_label_units() -> tuple[str, float]:
    """UNIT and SCALING_FACTOR for the far DEM image object, read from its PDS label."""
    lbl = (config.DEM_FAR / config.FAR_DEM_LBL).read_text()
    unit = re.search(r"^\s*UNIT\s*=\s*(\w+)", lbl, re.M).group(1).upper()
    scale = float(re.search(r"^\s*SCALING_FACTOR\s*=\s*([0-9.eE+-]+)", lbl, re.M).group(1))
    return unit, scale


@lru_cache(maxsize=1)
def load_far() -> Raster:
    unit, scale = _far_label_units()
    if unit != "KILOMETER":
        raise ValueError(f"unexpected far DEM unit {unit}")
    with rasterio.open(config.DEM_FAR / config.FAR_DEM_LBL) as ds:
        raw = ds.read(1)
        nod = ds.nodata
        data = raw.astype(np.float32) * np.float32(scale * 1000.0)  # km -> m, relative to 1737.4 km
        if nod is not None:
            data[raw == nod] = np.nan
        data[np.abs(raw) > 100] = np.nan  # any remaining fill values
        return _from_dataset(ds, "LDEM_75S_120M", data)


@lru_cache(maxsize=16)
def load_near(pgda_site: str) -> Raster:
    path = config.DEM_NEAR / f"{pgda_site}_final_adj_5mpp_surf.tif"
    with rasterio.open(path) as ds:
        data = ds.read(1).astype(np.float32)
        if ds.nodata is not None and not np.isnan(ds.nodata):
            data[data == ds.nodata] = np.nan
        return _from_dataset(ds, pgda_site, data)


def available_near_sites() -> list[str]:
    return sorted(p.name.split("_")[0] for p in config.DEM_NEAR.glob("Site*_final_adj_5mpp_surf.tif"))


class TerrainSampler:
    """Height (m above the 1737.4 km sphere) at planetocentric lat/lon, from a priority list of rasters.

    Rasters are tried in order; the first finite value wins (5 m tiles first, then 120 m).
    """

    def __init__(self, rasters: list[Raster]):
        if not rasters:
            raise ValueError("no rasters")
        self.rasters = rasters
        defs = {r.crs_proj4 for r in rasters}
        if len(defs) != 1:
            raise ValueError(f"rasters must share one projection, got {defs}")
        self._crs = rasterio.crs.CRS.from_proj4(rasters[0].crs_proj4)
        self._geo = f"+proj=longlat +R={rasters[0].radius_m} +no_defs"

    def project(self, lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        x, y = warp_transform(self._geo, self._crs, np.ravel(lon), np.ravel(lat))
        return np.asarray(x).reshape(np.shape(lat)), np.asarray(y).reshape(np.shape(lat))

    def heights(self, lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Returns (height_m, source_index) — source_index -1 where no raster has data."""
        lat = np.asarray(lat, dtype=np.float64)
        lon = np.asarray(lon, dtype=np.float64)
        x, y = self.project(lat, lon)
        h = np.full(lat.shape, np.nan)
        src = np.full(lat.shape, -1, dtype=np.int8)
        for k, r in enumerate(self.rasters):
            need = np.isnan(h)
            if not need.any():
                break
            v = r.sample(x[need], y[need])
            got = np.isfinite(v)
            idx = np.flatnonzero(need)[got]
            h.flat[idx] = v[got]
            src.flat[idx] = k
        return h, src

    def __call__(self, lat, lon) -> np.ndarray:
        return self.heights(lat, lon)[0]


@lru_cache(maxsize=1)
def default_sampler() -> TerrainSampler:
    """All 5 m tiles (mosaic) then the 120 m far-field DEM."""
    return TerrainSampler([load_near(s) for s in available_near_sites()] + [load_far()])


def horizon_source(lat: float, lon: float, sampler: TerrainSampler | None = None) -> str:
    """'5m+120m' if the site itself is on a 5 m tile; '120m' if only the far DEM covers it; else 'smooth-sphere'."""
    sampler = sampler or default_sampler()
    h, src = sampler.heights(np.array([lat]), np.array([lon]))
    if src[0] < 0 or not np.isfinite(h[0]):
        return "smooth-sphere"
    return "5m+120m" if sampler.rasters[src[0]].name != "LDEM_75S_120M" else "120m"
