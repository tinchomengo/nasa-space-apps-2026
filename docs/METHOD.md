# Method

T-Minus precomputes everything offline in Python (`pipeline/`) and ships static JSON to the web app. The app makes no live API calls.

## In plain language

For each landing site, we work out where the Sun and Earth are in the lunar sky every 10 minutes from November 2026 to January 2029. We also trace the real skyline around the site from NASA's laser-altimeter terrain maps (LOLA). Whenever the Sun or Earth is above that skyline, the lander has power or a radio path home. The countdowns are the time until the next crossing of that skyline.

## Defaults (what the UI shows unless you change it)

| Quantity | Default definition | Also reported |
|---|---|---|
| **Sun up / sunlit** (countdown `T-SUNSET`) | **At least 50% of the solar disc** is above the terrain, i.e. the Sun's centre is above the local horizon mask | any part of the disc; full disc; mean visible fraction of the disc |
| **Earth visible / DTE possible** (countdown `T-EARTHSET`) | **Earth's centre** is above the terrain | any part of the disc; full disc |
| **Link possible** | Earth's centre above the terrain at the site **and** the Moon above a 10° mask at Malargüe or at least one DSN complex | per-station breakdown |
| **Observer height** | **2 m** above the terrain (mast or antenna) | — |

Why these defaults: the 50% Sun disc matches the "centre crosses the horizon" event that people expect from a sunset, and it sits between the generous "any part" and the strict "full disc" definitions. For Earth, published studies disagree. PGDA counts Earth as visible if *any* part of the disc is visible, and Bryant (2009) reports both any-part and full-disc values. Earth's angular radius is about 0.95°, so the definition alone moves Earth-visible percentages by several points. We therefore report all three, and differences against published values partly reflect this choice.

## Ephemeris

- Skyfield with JPL **DE421** and the lunar body-fixed frame **MOON_ME_DE421** (NAIF kernels `moon_080317.tf`, `pck00008.tpc`, `moon_pa_de421_1900-2050.bpc`).
- Apparent positions: light time, aberration and gravitational deflection are included. **No atmospheric refraction** (the Moon has no atmosphere).
- Lunar physical librations and the Moon's orbital motion are part of the ephemeris and frame. Earth's wander in the lunar sky (about ±7° in elevation, ±8° in azimuth near the pole) is therefore modelled, not approximated.
- Azimuth is measured clockwise from local north. Elevation is measured from the plane perpendicular to the radius vector on the 1737.4 km reference sphere.
- Validated against JPL Horizons (DE441): see [VALIDATION.md](VALIDATION.md). The maximum separation is 0.04″.

## Terrain horizon

- **Near field:** NASA PGDA product 78, LOLA 5 m/px site maps (Barker et al. 2021). All seven tiles are used as one mosaic, so a ray from one site that crosses another site's tile uses 5 m data there too.
- **Far field:** LOLA GDR `LDEM_75S_120M` (120 m/px, poleward of 75°S), out to 150 km.
- Heights are relative to the 1737.4 km sphere. The 5 m and 120 m products agree to < 0.25 m mean (std about 2 m) on every tile, which checks units, reference radius and georeferencing.
- 720 azimuths (0.5°). Each ray follows the great circle on the sphere with steps growing from 5 m to 200 m (843 samples to 150 km). Every terrain sample becomes a 3D point, and the elevation angle from the observer is exact; curvature is not approximated.
- `horizon_source` per site: `5m+120m` (site on a 5 m tile), `120m` (far-field DEM only, e.g. the IM-2 site), or `smooth-sphere` (outside the polar DEMs: Chandrayaan-3, Apollo). A smooth-sphere horizon is the geometric dip for a 2 m observer, −0.087°.
- Tests: smooth sphere, synthetic mountains checked against an independent brute-force profile and bearing formula, ring and mirror symmetry, and our local frame against Skyfield's altaz (`pipeline/tests/`).

## Visible fraction, events and countdowns

- `clearance = elevation − horizon(azimuth)`, with the horizon mask linearly interpolated at the body's azimuth.
- Visible fraction of a disc of angular radius *r* uses the circular-segment formula, assuming the horizon is locally straight across the disc.
- Rise/set events are found on the 10-minute series and refined to the minute by linear interpolation of the clearance between samples.
- Countdown at time *t*: time to the next set event if the body is up, otherwise time to the next rise.

## Ground stations

The Moon's elevation is computed from Malargüe DSA-3 (ESA, Argentina), Goldstone DSS-14, Madrid DSS-63 and Canberra DSS-43, with a 10° mask and no refraction. The target is the Moon's centre; the lander's offset changes this by at most about 0.3°, which is negligible against a 10° mask.

## Site coordinates

See `pipeline/sites.py` for the source of every coordinate:
- **PGDA ROI** (Site01/04/07/11): a point inside the largest published region with > 70% average illumination.
- **LOLA 120 m local summit** (Malapert, Nobile Rim 1): no ROI is published, and the tile centres lie on slopes. We use the highest 120 m DEM point within 15 km of the tile centre.
- **Published** (IM-2, Chandrayaan-3, Apollo): mission coordinates.

Validation against published studies is evaluated at the **exact published points**, never at these display sites.

## Known limitations

- A summit is not always the best point for Earth visibility. At the Malapert summit the horizon in Earth's direction is set by the summit's own rounded shoulder, 0.1–0.5 km away, at about −1.7°. A 2 m mast there loses Earth's centre about 20% of the time, even though a sharp peak of the same height would have a dip of about 4.4°.
- Terrain beyond 150 km is ignored.
- DEM uncertainty is not propagated (PGDA provides clone DEMs; this is a stretch goal).
- The lander is a point; its tilt and shadowing by its own structure are not modelled.
