"""Frame and geometry checks for ephem.py.

The key test: our own ENU projection (used by horizon.py for DEM rays) must give the same
azimuth/elevation as Skyfield's altaz. An azimuth convention mismatch between the two is
the #1 bug risk in this project (CLAUDE.md §10).
"""
from datetime import datetime, timezone

import numpy as np
import pytest

from pipeline import ephem
from pipeline.sites import SITES

pytestmark = pytest.mark.skipif(
    not (ephem.config.KERNELS / ephem.config.KERNEL_EPHEM).exists(), reason="kernels not downloaded"
)


@pytest.fixture(scope="module")
def times():
    t, _ = ephem.utc_range(datetime(2027, 1, 1, tzinfo=timezone.utc), datetime(2027, 3, 1, tzinfo=timezone.utc), 360)
    return t


def _wrap(d):
    return (d + 180.0) % 360.0 - 180.0


@pytest.mark.parametrize("site", SITES, ids=lambda s: s.id)
@pytest.mark.parametrize("body", ephem.BODIES)
def test_enu_matches_skyfield_altaz(site, body, times):
    sky = ephem.topocentric(site.lat, site.lon, 0.0, times, body)
    v = ephem.body_vectors_me(site.lat, site.lon, 0.0, times, body)
    az, el = ephem.az_el_from_vectors(v, site.lat, site.lon)
    assert np.max(np.abs(el - sky["el_deg"])) < 1e-6
    # azimuth is ill-defined at the zenith; skip near-zenith samples (equatorial sites)
    ok = sky["el_deg"] < 89.0
    assert np.max(np.abs(_wrap(az[ok] - sky["az_deg"][ok]))) < 1e-6


def test_enu_basis_orthonormal():
    for lat, lon in [(-89.46, -137.49), (-85.0, 30.0), (0.67, 23.47), (20.0, -120.0)]:
        e, n, u = ephem.enu_basis(lat, lon)
        m = np.stack([e, n, u])
        assert np.allclose(m @ m.T, np.eye(3), atol=1e-12)
        assert np.allclose(np.cross(e, n), u, atol=1e-12)  # right-handed
        assert n[2] > 0  # local north points toward +z (the north pole)


def test_angular_radii(times):
    sun = ephem.topocentric(-89.4632, -137.4896, 0.0, times, "sun")
    earth = ephem.topocentric(-89.4632, -137.4896, 0.0, times, "earth")
    assert 0.26 < sun["ang_radius_deg"].min() and sun["ang_radius_deg"].max() < 0.275
    # Earth: ~0.90° at apogee, ~1.03° at perigee (6371 km / ~355,000 km from the lunar surface)
    assert 0.88 < earth["ang_radius_deg"].min() and earth["ang_radius_deg"].max() < 1.04


def test_polar_geometry_sanity():
    """Sun skims the horizon at the pole; Earth's centre wanders ~±7° el and ~±8° az (CLAUDE.md §6)."""
    t, _ = ephem.utc_range(datetime(2027, 1, 1, tzinfo=timezone.utc), datetime(2028, 1, 1, tzinfo=timezone.utc), 60)
    lat, lon = -89.4632, -137.4896  # 0.54° from the pole
    sun = ephem.topocentric(lat, lon, 0.0, t, "sun")
    earth = ephem.topocentric(lat, lon, 0.0, t, "earth")
    colat = 90.0 + lat
    assert np.abs(sun["el_deg"]).max() < 1.6 + colat
    assert np.abs(earth["el_deg"]).max() < 7.0 + colat
    az = earth["az_deg"]
    spread = _wrap(az - np.degrees(np.angle(np.mean(np.exp(1j * np.radians(az))))))
    assert np.abs(spread).max() < 10.0
