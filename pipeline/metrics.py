"""Visibility metrics, rise/set events and window statistics.

Definitions (documented in METHOD.md):
- clearance = body elevation - terrain horizon elevation at the body's azimuth (deg).
- Disc visible fraction: area fraction of a disc of angular radius r above a locally straight
  horizon at offset `clearance` from the disc centre (circular-segment formula).
- Sun: three definitions, reported side by side: any part of the disc (clearance > -r),
  at least 50% of the disc (clearance >= 0, i.e. the centre), and the full disc (clearance > r).
  UI/countdown DEFAULT = >= 50% of the disc: sunrise/sunset events are the Sun-centre crossings.
- Earth "visible" (UI default for DTE): Earth's CENTRE above the terrain (clearance > 0).
  Also reported: any limb (clearance > -r) and full disc (clearance > r), because published
  studies use different definitions.
- Events are found on the 10-min series and refined to the minute by linear interpolation of
  the crossing quantity between samples.
"""
from __future__ import annotations

import numpy as np


def disc_visible_fraction(clearance_deg: np.ndarray, radius_deg: np.ndarray) -> np.ndarray:
    x = np.clip(np.asarray(clearance_deg) / np.asarray(radius_deg), -1.0, 1.0)
    hidden = (np.arccos(x) - x * np.sqrt(1.0 - x * x)) / np.pi
    return 1.0 - hidden


def crossings(g: np.ndarray, t_unix: np.ndarray, up: str, down: str) -> list[dict]:
    """Events where g changes sign (g > 0 means 'up'). Times refined by linear interpolation, to the minute."""
    pos = g > 0
    idx = np.flatnonzero(pos[1:] != pos[:-1])
    g0, g1 = g[idx], g[idx + 1]
    frac = np.where(g1 != g0, -g0 / (g1 - g0), 0.5)
    tt = t_unix[idx] + frac * (t_unix[idx + 1] - t_unix[idx])
    tt = np.round(tt / 60.0) * 60.0
    return [{"type": up if pos[i + 1] else down, "t": int(x)} for i, x in zip(idx, tt)]


def longest_run_hours(mask: np.ndarray, step_s: float) -> float:
    """Longest contiguous run of True, in hours (runs touching the span ends are included as-is)."""
    if not mask.any():
        return 0.0
    m = np.concatenate([[False], mask, [False]]).astype(np.int8)
    d = np.diff(m)
    starts, ends = np.flatnonzero(d == 1), np.flatnonzero(d == -1)
    return float((ends - starts).max() * step_s / 3600.0)


def pct(mask: np.ndarray) -> float:
    return float(100.0 * np.mean(mask))


def window_stats(sun_clear: np.ndarray, sun_r: np.ndarray, earth_clear: np.ndarray, earth_r: np.ndarray,
                 step_s: float, link_any: np.ndarray | None = None) -> dict:
    """Percentages of time. Defaults: Sun >= 50% of disc; Earth centre above the terrain."""
    sunlit = sun_clear > 0  # default: >= 50% of the solar disc
    earth_c = earth_clear > 0
    out = {
        "sunlit_pct": pct(sunlit),
        "sunlit_any_part_pct": pct(sun_clear > -sun_r),
        "sunlit_half_disc_pct": pct(sunlit),
        "sunlit_full_disc_pct": pct(sun_clear > sun_r),
        "sun_mean_visible_pct": float(100.0 * np.mean(disc_visible_fraction(sun_clear, sun_r))),
        "earth_visible_pct": pct(earth_c),
        "earth_visible_any_limb_pct": pct(earth_clear > -earth_r),
        "earth_visible_full_disc_pct": pct(earth_clear > earth_r),
        "both_pct": pct(sunlit & earth_c),
        "neither_pct": pct(~sunlit & ~earth_c),
        "longest_dark_h": longest_run_hours(~sunlit, step_s),
        "longest_dte_gap_h": longest_run_hours(~earth_c, step_s),
    }
    if link_any is not None:
        out["link_pct"] = pct(earth_c & link_any)
        out["longest_link_gap_h"] = longest_run_hours(~(earth_c & link_any), step_s)
    return out
