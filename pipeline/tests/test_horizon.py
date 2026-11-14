"""Horizon ray-march tests (CLAUDE.md §5.5): smooth sphere, synthetic mountain, symmetry, frame."""
import numpy as np
import pytest

from pipeline import horizon
from pipeline.ephem import unit_vector_me

R = horizon.R


def flat(lat, lon):
    return np.zeros(np.shape(lat))


def bump(lat0, lon0, height, sigma_m):
    c = unit_vector_me(lat0, lon0)

    def f(lat, lon):
        ang = np.arccos(np.clip(unit_vector_me(lat, lon) @ c, -1, 1))
        return height * np.exp(-0.5 * (ang * R / sigma_m) ** 2)
    return f


def ring(lat0, lon0, height, radius_m, sigma_m):
    c = unit_vector_me(lat0, lon0)

    def f(lat, lon):
        ang = np.arccos(np.clip(unit_vector_me(lat, lon) @ c, -1, 1))
        return height * np.exp(-0.5 * ((ang * R - radius_m) / sigma_m) ** 2)
    return f


def bearing_deg(lat1, lon1, lat2, lon2):
    """Standard great-circle initial bearing (independent of our ENU code)."""
    p1, p2, dl = np.radians(lat1), np.radians(lat2), np.radians(lon2 - lon1)
    return np.degrees(np.arctan2(np.sin(dl) * np.cos(p2),
                                 np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dl))) % 360


def destination(lat, lon, bearing, dist_m):
    """Standard great-circle destination formula (independent of our ENU code)."""
    p1, l1, b, d = np.radians(lat), np.radians(lon), np.radians(bearing), dist_m / R
    p2 = np.arcsin(np.sin(p1) * np.cos(d) + np.cos(p1) * np.sin(d) * np.cos(b))
    l2 = l1 + np.arctan2(np.sin(b) * np.sin(d) * np.cos(p1), np.cos(d) - np.sin(p1) * np.sin(p2))
    return np.degrees(p2), np.degrees(l2)


def expected_max_elevation(lat, lon, h_obs, bearing, heights, max_range=60_000.0):
    """Dense (1 m) brute-force horizon along one bearing. For a broad bump the near flank can
    subtend more than the summit, so the max over the profile is the reference, not the summit."""
    d = np.arange(1.0, max_range, 1.0)
    la, lo = destination(lat, lon, bearing, d)
    h = heights(la, lo)
    u = unit_vector_me(lat, lon)
    v = (R + h)[:, None] * unit_vector_me(la, lo) - (R + h_obs) * u
    return np.degrees(np.arcsin(v @ u / np.linalg.norm(v, axis=1))).max()


def test_smooth_sphere_2m():
    res = horizon.compute_horizon(-89.45, -137.15, flat, h_obs=2.0, site_height_m=0.0)
    expected = -np.degrees(np.arccos(R / (R + 2.0)))
    assert expected == pytest.approx(-0.0870, abs=5e-4)
    assert np.allclose(res.el_deg, expected, atol=2e-4)
    assert np.nanmedian(res.dist_m) == pytest.approx(np.sqrt(2 * R * 2.0), rel=0.1)  # ~2.6 km


@pytest.mark.parametrize("site,peak", [
    ((-89.0, 0.0), (-88.6, 0.0)),        # due north
    ((-89.0, 0.0), (-89.4, 0.0)),        # due south (toward the pole)
    ((-88.5, 40.0), (-88.5, 60.0)),      # ~16 km roughly east; great circle bends poleward
    ((-85.0, -30.0), (-84.7, -32.0)),    # ~10 km north-west
    ((-89.9, 170.0), (-89.7, -10.0)),    # ray crosses the pole region
])
def test_synthetic_mountain(site, peak):
    H, sigma = 1500.0, 1500.0
    terrain = bump(*peak, H, sigma)
    res = horizon.compute_horizon(*site, terrain, h_obs=2.0, site_height_m=0.0)
    k = int(np.argmax(res.el_deg))
    want_az = bearing_deg(*site, *peak)
    d_az = (res.az_deg[k] - want_az + 180) % 360 - 180
    assert abs(d_az) <= 0.5, (res.az_deg[k], want_az)
    # compare at the exact bearing: interpolate our mask there vs a dense independent profile
    want_el = expected_max_elevation(*site, 2.0, want_az, terrain)
    assert horizon.interp_mask(res.el_deg, want_az) == pytest.approx(want_el, abs=0.02)
    # far from the bump the horizon is the smooth-sphere dip
    opposite = (k + 360) % 720
    assert res.el_deg[opposite] == pytest.approx(horizon.smooth_sphere_dip_deg(2.0), abs=0.01)


def test_ring_symmetry():
    lat, lon = -88.0, 60.0
    res = horizon.compute_horizon(lat, lon, ring(lat, lon, 800.0, 12_000.0, 600.0), h_obs=2.0, site_height_m=0.0)
    assert res.el_deg.std() < 0.005
    assert res.el_deg.mean() > 3.0


def test_mirror_symmetry():
    lat, lon = -87.0, 0.0
    a = horizon.compute_horizon(lat, lon, bump(-86.9, 2.0, 1000, 1000), site_height_m=0.0)
    b = horizon.compute_horizon(lat, lon, bump(-86.9, -2.0, 1000, 1000), site_height_m=0.0)
    # mirror about the meridian: az -> 360 - az
    mirrored = np.roll(b.el_deg[::-1], 1)
    assert np.allclose(a.el_deg, mirrored, atol=1e-3)


def test_interp_mask_periodic():
    m = np.arange(720, dtype=float)
    assert horizon.interp_mask(m, 359.75) == pytest.approx(0.5 * 719 + 0.5 * 0)
    assert horizon.interp_mask(m, 0.25) == pytest.approx(0.5)
