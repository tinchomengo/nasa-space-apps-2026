import numpy as np
import pytest

from pipeline import metrics


def test_disc_fraction_limits():
    r = 0.27
    assert metrics.disc_visible_fraction(0.0, r) == pytest.approx(0.5)
    assert metrics.disc_visible_fraction(r, r) == pytest.approx(1.0)
    assert metrics.disc_visible_fraction(-r, r) == pytest.approx(0.0)
    assert metrics.disc_visible_fraction(5.0, r) == pytest.approx(1.0)
    # symmetry: f(c) + f(-c) = 1
    c = np.linspace(-r, r, 11)
    assert np.allclose(metrics.disc_visible_fraction(c, r) + metrics.disc_visible_fraction(-c, r), 1.0)


def test_disc_fraction_known_segment():
    # line through r/2 below centre: hidden segment = (acos(.5) - .5*sqrt(.75))/pi = 0.1955
    assert metrics.disc_visible_fraction(0.5, 1.0) == pytest.approx(1 - 0.19550, abs=1e-4)


def test_crossings_interpolated_to_minute():
    t = np.arange(0, 6) * 600.0  # 10-min steps
    g = np.array([-2.0, -1.0, 1.0, 2.0, -2.0, -3.0])
    ev = metrics.crossings(g, t, "rise", "set")
    assert ev == [{"type": "rise", "t": 900}, {"type": "set", "t": 1800 + 300}]


def test_longest_run():
    m = np.array([0, 1, 1, 0, 1, 1, 1, 0], bool)
    assert metrics.longest_run_hours(m, 3600) == 3.0
    assert metrics.longest_run_hours(np.zeros(4, bool), 3600) == 0.0
    assert metrics.longest_run_hours(np.ones(4, bool), 600) == pytest.approx(4 / 6)
