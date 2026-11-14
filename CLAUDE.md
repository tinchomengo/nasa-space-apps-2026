# T-Minus: Mission Clock — Claude Code handover

> Put this file at the root of the new repo (`~/Desktop/space-projects/nasa-space-apps-2026/CLAUDE.md`) so it loads automatically.
> Owner: Martín Mengo (solo). Event: NASA Space Apps Challenge 2026, Buenos Aires local event.
> **Hard deadline: Sun 2026-11-15 23:59 ART (UTC-3). Target submit: 23:30.** Started Sat 2026-11-14 ~11:00.

---

## 0. How to work with me

- Concise, technical, no filler. Ask only when blocked on a decision that is mine to make. Otherwise pick the sensible default and say so in one line.
- Code, comments, docs, UI text: **English** (the submission must be in English).
- Ship in vertical slices. Something must be deployed and working by Saturday night. Never leave `main` broken.
- **Commit early and often** with clear messages. Commit timestamps are the proof that the project was built during the event.
- Everything is precomputed offline. **No live API calls (Horizons or anything else) at runtime in the web app.**
- Never claim a number is "validated" unless the validation script produced it. Show the differences against published values honestly.
- Before starting each milestone in §9, read this file again.

### Hackathon rules that affect the code

- Only work done during the event counts. The `fprime-labs/iss-tracker` code existed before the event: import it in **one clearly labelled commit** (see §7) and list it under References.
- **Do not open, read or copy code from other teams' public repos for this challenge** (e.g. Ridgeline, LunaNav, Lunar Horizon, LunarWindow, MoonSet, LunaMission, ziyadell/Lunar-Landing-Site-Navigator). Originality matters.
- No NASA logos or insignia anywhere in the UI or assets.
- Third-party libraries, data and code must be listed in `REFERENCES.md`.
- AI use (Claude Code) is allowed but must be disclosed. Keep a running log in `docs/AI_DISCLOSURE.md`.
- Use NASA data (LOLA/PGDA, JPL Horizons, NAIF SPICE kernels) and cite it.

---

## 1. The challenge (Lunar Landing Site Navigator), condensed

Build an intuitive tool that lets mission planners, educators and the public **compare lunar landing sites and dates quickly**. It must show **Sun and Earth positions relative to the local horizon** so users can judge **power** (Sun) and **direct-to-Earth (DTE) communication windows** (Earth). Focus: the **south pole**, where the Sun and Earth skim the horizon and small changes in location or date matter enormously.

The objectives the judges will check us against:

1. Curated site list (Apollo, CLPS, commercial, other countries) plus custom coordinates; side-by-side comparison.
2. Selectable date and time; changes across lunar days and seasons; schedule slips.
3. Sun and Earth relative to the horizon; **time remaining until sunset and Earthset**.
4. Metrics: solar elevation, sunlight duration, Earth visibility windows.
5. 2D, 3D or creative visualizations; animations and timelines.
6. Accessible to experts and to the public.

Accuracy points they call out: real LOLA topography for the horizon, **no atmospheric refraction**, Earth libration, steep south-pole terrain.

Judging criteria: Influence, Creativity, Validity, Relevance, Presentation.

## 2. Product: what we are building

**T-Minus: Mission Clock.** Pick a south-pole site and a date. T-Minus counts down to **sunset** and **Earthset** over the **real terrain horizon**, tells you whether **ESA's Malargüe station (Argentina)** or the DSN can hear the lander, and re-plans instantly when the launch slips.

What sets it apart from the many generic "Sun/Earth over horizon" tools:

1. A countdown-first interface (the challenge explicitly calls time-to-sunset/Earthset "critical operational information").
2. A **two-horizon link model**: Earth above the *lunar terrain* horizon **and** the Moon above the *ground station's* horizon (Malargüe + DSN).
3. A **validation table** comparing our results with JPL Horizons and published studies.
4. A **physical lander high-gain-antenna (HGA) twin**: the existing F´ ISS-tracker mount points at Earth as seen from the site and stows at Earthset.

### Feature list

**MUST (Saturday-night MVP, then polish):**
- M1. Site picker: about 10 curated sites (§4) plus custom lat/lon.
- M2. Date/time picker plus a **slip slider** (±60 days) that moves the epoch and recomputes everything instantly.
- M3. **Countdown cards** per site: `T-Sunset`, `T-Earthset`, next sunrise/Earthrise, current solar elevation, current Earth elevation, Sun visible fraction, Earth visibility state. Green/amber/red by threshold.
- M4. **Horizon panorama**: a 360° strip (azimuth × elevation, vertically exaggerated and labelled) showing the terrain silhouette plus Sun and Earth tracks over a window (e.g. ±14 days), with a time cursor and play/pause animation.
- M5. **Compare mode**: 2–3 sites side by side at the same epoch.
- M6. **Window timeline**: per site, a horizontal bar across the window with sunlit / Earth-visible / both / neither segments.
- M7. Window metrics: sunlit %, Earth-visible %, both %, longest darkness, longest DTE gap.
- M8. **Validation page**: (a) our ephemeris vs JPL Horizons, (b) our long-run sunlit and Earth-visible % vs published values (§6).
- M9. Method page: data, algorithms, assumptions and limitations, in plain language plus technical detail.
- M10. Deployed on Vercel; public GitHub repo.

**SHOULD (Sunday):**
- S1. **Link badge**: DTE possible now? Requires terrain-clear Earth **and** Moon above the station mask at Malargüe / Goldstone / Madrid / Canberra. Show which stations can hear the lander. Cheap (about 1 h) and carries the local story.
- S2. **F´ lander HGA twin** (hardware, §7).
- S3. Educator / plain-language mode toggle with short explanations ("Why does the Sun never climb at the pole?").
- S4. Printable horizon ring (SVG/PDF of the site's skyline using the same mapping as the hardware).

**STRETCH (only if ahead):**
- X1. Slip heatmap: site × landing date coloured by a mission rule (e.g. ≥ N h Sun and ≥ M h Earth in the first K days).
- X2. Vertical solar-array power proxy plus a battery margin over the longest darkness.
- X3. three.js mini scene: terrain patch with Sun/Earth direction vectors.
- X4. DEM uncertainty band using the PGDA product 78 clone DEMs.
- X5. MPU6050 slope-compensated antenna pointing (§7.4).

**OUT OF SCOPE:** Sun pointing on hardware (needs 360° azimuth; the mount only has ±90°), phone AR, live API calls, user accounts.

---

## 3. Repo layout (new repo)

```
~/Desktop/space-projects/nasa-space-apps-2026/   # new git repo -> GitHub: tinchomengo/tminus-lunar (public)
├── CLAUDE.md                              # this file
├── README.md                              # pitch, demo link, how to run, screenshots/GIF
├── REFERENCES.md                          # data, papers, libraries, pre-existing code
├── docs/
│   ├── METHOD.md                          # algorithms, frames, assumptions
│   ├── VALIDATION.md                      # generated tables + discussion
│   └── AI_DISCLOSURE.md
├── pipeline/                              # Python, offline precompute
│   ├── requirements.txt
│   ├── config.py                          # constants, time span, thresholds, paths
│   ├── sites.py                           # curated sites (§4)
│   ├── kernels.py                         # Skyfield kernel loading (cached in data/kernels)
│   ├── ephem.py                           # Sun/Earth topocentric az/el/distance from lunar sites
│   ├── dem.py                             # DEM loading + sampling (near 5 m + far coarse)
│   ├── horizon.py                         # 720-azimuth horizon mask via 3D ray-march
│   ├── metrics.py                         # visibility fractions, events, countdowns, window stats
│   ├── stations.py                        # Malargüe + DSN Moon visibility
│   ├── build.py                           # orchestrates everything -> web/public/data/*.json
│   ├── validate_horizons.py               # Skyfield vs JPL Horizons spot checks
│   ├── validate_published.py              # vs published % (and PGDA 69 pixel samples)
│   └── tests/                             # pytest: synthetic sphere/mountain horizon, frames
├── data/                                  # gitignored raw downloads (DEMs, kernels)
├── web/                                   # Vite + React + TypeScript
│   ├── public/data/                       # generated JSON (committed; small)
│   └── src/...
└── flight/                                # F´ HGA twin (imported from fprime-labs/iss-tracker, §7)
```

`.gitignore`: `data/`, large DEMs, venvs, `node_modules`, F´ build dirs. The generated JSON in `web/public/data/` **is committed** so Vercel needs no Python.

## 4. Curated sites

Prefer the **official site centres from the PGDA product 78 README** where a site has a 5 m DEM. The coordinates below are approximate starting points: verify, and label the source of each in `sites.py`. Status labels read "as of Nov 2026".

| id | Name | Lat | Lon (E, −180..180) | Why it's in the list |
|---|---|---|---|---|
| `connecting-ridge` | Shackleton Connecting Ridge (PGDA Site01) | ≈ −89.45 | ≈ −137.3 | Best long-term illumination; Blue Origin Blue Moon MK1 "Endurance" target (NET early 2027) |
| `shackleton-rim` | Shackleton rim (Site04) | ≈ −89.7 | ≈ −160 | Classic high-illumination rim |
| `peak-near-shackleton` | Peak near Shackleton (Site07) | ≈ −88.8 | ≈ 123.4 | Chang'e-7 target (slipped to 2027) |
| `de-gerlache-rim` | de Gerlache rim (Site11) | ≈ −88.7 | ≈ −68.5 | Artemis IV candidate region (de Gerlache Rim 2) |
| `malapert` | Malapert massif (Site23) | ≈ −86.0 | ≈ 2.7 | Earth almost always in view; Artemis candidate |
| `mons-mouton` | Mons Mouton / IM-2 site (Leibnitz β, Site20) | −84.7906 | 29.1957 | IM-2 landed 6 Mar 2025, tipped over, ran about 12 h 45 m before power ran out; Artemis candidate |
| `nobile-rim-1` | Nobile Rim 1 (Site06) | ≈ −85 | ≈ 45–60 | Artemis candidate; Griffin-1 area |
| `chandrayaan-3` | Chandrayaan-3 | −69.37 | 32.32 | "Near south pole" contrast |
| `apollo-11` | Apollo 11 | 0.67 | 23.47 | Equatorial contrast |
| `apollo-17` | Apollo 17 | 20.19 | 30.77 | Equatorial contrast |

Non-polar sites (Chandrayaan-3, Apollo) lie outside the south-pole DEMs. Use a **smooth-sphere horizon** for them (horizon = geometric dip for the observer height) and label it in the UI. Custom coordinates poleward of the DEM coverage get a real horizon; others get the smooth-sphere horizon with a note.

Context for copy (as of Nov 2026; label dates as such): Artemis was renumbered in Feb 2026. Artemis III is a crewed LEO docking test (mid-2027); **Artemis IV (early 2028) is the first crewed landing and targets the south pole**. Nine candidate regions: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain. NASA's LPSC 2026 site-selection abstract notes DTE favours regions with more Earth visibility, and that polar illumination patterns shift about 2–3 weeks per year. That sentence is our "why".

## 5. Data and algorithms

### 5.1 Time span and steps
- Span: **2026-11-01 → 2029-01-01 UTC** (covers Endurance, Griffin, Chang'e-7, Artemis IV).
- Compute at **10-minute** steps internally (about 115k epochs per site; vectorized Skyfield handles this).
- Export: **hourly** az/el series (for the panorama and the mount) plus an **event list** with minute precision (rise/set refined by interpolation or bisection), plus window summaries. The front end derives countdowns from the event list, which is cheap and exact.

### 5.2 Ephemeris (`ephem.py`)
- Skyfield with the lunar body-fixed frame (Skyfield's documented "position on the Moon" approach):
  - kernels: `de421.bsp`, `moon_080317.tf`, `pck00008.tpc`, `moon_pa_de421_1900-2050.bpc`
  - `pc = PlanetaryConstants(); pc.read_text(...); pc.read_binary(...)`
  - `frame = pc.build_frame_named('MOON_ME_DE421')`
  - `site = moon + pc.build_latlon_degrees(frame, lat, lon, elevation_m)`
  - `site.at(t).observe(sun|earth).apparent().altaz()` → alt, az, distance
- **No refraction** (no atmosphere). Make sure Skyfield applies no refraction (don't pass temperature or pressure).
- Output per body: azimuth (deg, clockwise from local north), elevation (deg), distance (km) → angular radius: Sun `asin(696340/d)` ≈ 0.27°, Earth `asin(6371/d)` ≈ 0.95°.
- Observer height above the surface: a config value, default **2 m** (mast/antenna). Report it everywhere.
- Libration and orbital variations are inherent in the ephemeris and frame; say so in METHOD.md (objective checked).

### 5.3 Validation against JPL Horizons (`validate_horizons.py`)
- API: `https://ssd.jpl.nasa.gov/api/horizons.api` with `format=json`, `COMMAND='10'` (Sun) / `'399'` (Earth), `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='<E-lon>,<lat>,<alt_km>'`, `EPHEM_TYPE='OBSERVER'`, `QUANTITIES='4'` (apparent az/el), `APPARENT='AIRLESS'`, `START_TIME`, `STOP_TIME`, `STEP_SIZE`.
- At least 5 sites × 3 epochs × 2 bodies. Report max/mean |Δaz| and |Δel|. Horizons uses a newer lunar orientation (DE44x) than DE421, so small differences are expected; document them. Target: < 0.05°, report the actual values.
- Cache the responses in `data/horizons_cache/` so the script runs offline afterwards. Write the table to `docs/VALIDATION.md` and `web/public/data/validation.json`.

### 5.4 DEMs (`dem.py`)
- **Near field:** NASA PGDA **product 78** (Barker et al. 2021, *Planet. Space Sci.* 203:105119): 5 m/px site GeoTIFFs, south polar stereographic in metres, MOON_ME DE421 frame. Includes slope, uncertainty and clone DEMs. Start at `https://pgda.gsfc.nasa.gov/products/78` (mirror: `https://core2.gsfc.nasa.gov/PGDA/LOLA_5mpp/`). Download only the tiles for our sites.
- **Far field (horizon to about 150 km):** a coarser LOLA south-polar stereographic DEM (PDS LOLA GDR polar products, e.g. at `https://imbrium.mit.edu/` under LOLA GDR polar, at roughly 60–240 m/px; or PGDA product 81, the 5 m mosaic poleward of 87°S, if the size is manageable). Pick the smallest product that covers **≥ 150 km around every polar site**. Verify product names and sizes before downloading; tell me if a download is over about 2 GB.
- **Always read the CRS and transform from the file** (rasterio). Don't hard-code projection parameters. Confirm whether heights are relative to the **1737.4 km sphere** and their units (m vs km) from each product's label/README.
- Sampling: bilinear; handle nodata; the far DEM is used beyond the near DEM's extent (or where near is nodata).

### 5.5 Horizon mask (`horizon.py`)
- 720 azimuths (0.5°), clockwise from local north.
- **Local frame (critical):** build an ENU basis at the site from the MOON_ME position vector: up = r̂; east = ẑ × up normalized; north = up × east. **Skyfield's altaz must use the same convention.** Add a unit test that the Sun azimuth computed by Skyfield and by our own ENU projection of the Sun vector agree.
- For each azimuth: march along the surface (great-circle destination formula on the 1737.4 km sphere) with geometrically growing steps (e.g. 5 m near → ≤ 500 m far, max range 150 km). Sample the height; build the 3D point P = (R + h)·û(lat, lon); observer O = (R + h_site + h_obs)·û(site). Elevation angle = `asin(dot(P − O, up) / |P − O|)`. Horizon = max over the ray. This handles curvature exactly; don't use the d²/2R approximation.
- Vectorize with numpy (all azimuths × all steps). Target: < 30 s per site.
- Tests: (a) **smooth sphere**: horizon ≈ −acos(R/(R+h_obs)) ≈ −0.087° for 2 m; (b) synthetic mountain of known height and distance at a known azimuth gives the expected angle; (c) symmetry sanity checks.
- Export: `horizon_<site>.json` with 720 elevations (deg).

### 5.6 Metrics (`metrics.py`)
- `clearance = el − horizon(az)` (interpolate the mask at the body's azimuth).
- **Disc visible fraction** with a flat-horizon approximation over the disc: fraction of a circle of radius r above a line at offset `clearance` (circular-segment area). Sun → visible fraction (power proxy). Earth → three definitions: **any limb** (clearance > −r), **centre** (clearance > 0), **full disc** (clearance > r). The **UI default for DTE is centre**; document why (published studies use different definitions, which explains part of the deltas).
- Events: sunrise/sunset = Sun visible fraction crosses 0 (also expose a "50% of disc" variant in METHOD.md); Earthrise/Earthset = Earth centre clearance crosses 0. Refine to the minute.
- Countdowns at epoch t: time to the next set event (if currently up) or the next rise event (if down).
- Window stats (for a selected window and for the full span): sunlit %, Earth-visible %, both %, longest darkness (h), longest DTE gap (h).
- Thresholds (config): green ≥ 72 h until set, amber 24–72 h, red < 24 h, or down.

### 5.7 Ground stations (`stations.py`)
- Earth sites as Skyfield `wgs84.latlon`: **Malargüe DSA-3** (−35.776, −69.398), **Goldstone** (≈ 35.426, −116.890), **Madrid/Robledo** (≈ 40.431, −4.248), **Canberra** (≈ −35.401, 148.982). Verify the coordinates.
- Moon above the station mask: default **10°** (config).
- Link possible = Earth centre terrain-clear at the lunar site **and** the Moon above the mask at ≥ 1 station. Export per-station boolean series (hourly) plus event lists.
- Copy fact: ESA's 35 m Malargüe antenna supports commercial lunar landers; CONAE coordinates Argentina's share of its time.

### 5.8 Output JSON (contract with the web app)
- `sites.json`: list with id, name, lat, lon, horizon source (dem / smooth-sphere), status label, sources.
- `site_<id>.json`: `{ meta, horizon[720], hourly: { t0, stepSec, sunAz[], sunEl[], earthAz[], earthEl[], sunFrac[], earthClear[] }, events: [{type, t}], stats: {...}, stations: {...} }`. Use compact numbers (2 decimals) and typed arrays where useful. Keep each file **< 3 MB**; otherwise split per year.
- `validation.json`: Horizons table plus published-value table.

## 6. Published values for the validation table (`validate_published.py`)

Compare our long-run (full-span) sunlit % and Earth-visible % at the closest equivalent points. **Expect differences** (DEM resolution, observer height, time span, point vs disc definitions). Show the deltas and explain them; do not tune parameters to match.

| Source | Point | Value |
|---|---|---|
| Gläser et al. 2014, *Icarus* | Ridge between Shackleton and de Gerlache | up to **88.0%** average illumination; 92.27% at 2 m, 95.65% at 10 m above ground (best points) |
| Bussey et al. 2010 | Point A (89.68°S, 166.0°W) / B (89.44°S, 141.8°W) / D (88.79°S, 124.5°E), lunar year 2020 | **81% / 82% / 86%** illuminated |
| Kumari et al. 2022, *PSJ* | Site 007 / Site 011 | **85.9% / 82.6%** illumination; DTE possible about 60% of the time |
| Bryant 2009, JPL IPN PR 42-176 | Ridge B1 (2 m tower) | Earth visible **65.16%** (any part), **51.33%** (full disc) |
| Bryant 2009 | Shackleton rim A1–A4 / de Gerlache rim C1 / Malapert & Leibnitz β peaks | about **62–64%** / **70.97%** / **100%** |
| NASA PGDA product 69 (Mazarico et al.) | Average-illumination and Earth-visibility GeoTIFFs (`AVGVISIB_*`, `*_EARTH`) | Sample the pixel at each site; note PGDA's caveat that Earth counts as visible if any part of the disc is visible |

Geometry sanity checks to include as asserts or notes: from the pole the Sun stays within about ±1.5° of the horizon; Earth's centre moves about ±6.5–7° in elevation and about ±8° in azimuth; DTE windows last about 14 days.

Our joint "Sun AND Earth" metric has no published reference. Say so explicitly.

## 7. F´ lander HGA twin (`flight/`, Sunday morning)

### 7.0 Hardware on hand at the event
Pico (confirm whether it's a Pico 2 W or a plain RP2040 Pico; the firmware targets the Pico 2 W, so rebuild with the right `PICO_BOARD` if needed), NEMA 17 stepper + TMC2209 (azimuth), analog servo (elevation; a second analog servo and a small servo are spare), MPU6050, 12 V and 5 V supplies, USB cable, breadboard and jumper wires. The original mount structure from the ISS tracker is here, already built. No LED/laser, which is optional. Keep the original wiring and power sequence (USB, then 12 V, then 5 V).

### 7.1 Starting point: existing project (read it, don't rewrite it)
`~/Desktop/space-projects/fprime-labs/iss-tracker` (F´ v4.2.2 submodule, Apache-2.0):
- `IssTracker/Components/Sgp4Propagator`: SGP4 → az/el/range; outputs az/el to AntennaController. **This is the component to replace.**
- `IssTracker/Components/AntennaController` (+ `TrackLogic`): waits at the rise azimuth, tracks, stows at set; commands `TRACK_START`/`TRACK_STOP`; param `MOUNT_ZERO_AZ_DEG`; events `PassStarted`, `PassComplete`, `AzimuthOutOfRange`; telemetry `Phase`, `TargetAzimuth`, `TargetElevation`.
- `IssTracker/Components/PicoLink` (+ `PicoProtocol`): USB serial to the Pico 2 W.
- `IssTracker/TrackerDeployment/` with `sequences/` (simulated pass test that replays a pass on a virtual observer → reuse this pattern for compressed time).
- Firmware `firmware/pico-tracker/tracker_core.hpp` protocol: `PING`, `ENABLE`, `DISABLE`, `ZERO_AZ`, `SET <az> <el>`, `STOW`, `HEARTBEAT <s>`; telemetry `TLM <az> <el> <state>` at 5 Hz. Limits: **az ±90°** (servo cable), **el 0–90°**, az 1/8 microstepping (4.444 µsteps/°), az max 90°/s, el max 45°/s. Open-loop az; el calibrated by eye. See `HARDWARE.md` for the power sequence (USB, then 12 V, then 5 V) and calibration.

### 7.2 Import (first flight commit)
Copy `iss-tracker` into `nasa-space-apps-2026/flight/` (excluding build artifacts; restore the `lib/fprime` and `lib/sgp4` submodules properly) as **one commit**:
`import: iss-tracker from fprime-labs@<sha> (pre-existing, Apache-2.0)`. Add it to REFERENCES.md. All later changes are new, dated commits.

### 7.3 Changes
1. **New component `EphemerisTable`** (replaces `Sgp4Propagator` in the topology; **mirror its output port types exactly**, so read `Sgp4Propagator.fpp` and `Ports/` first). It loads a CSV exported by the pipeline (`flight/data/<site>.csv`: `t_utc, earth_az, earth_el, earth_clearance`) and plays it on a **simulated clock** with a time-scale param (default: 14 days in about 90 s). Commands: `LOAD_SITE(name)`, `PLAY(start_utc, scale)`, `PAUSE`. Events: `SiteLoaded`, `PlaybackEnded`.
2. **Terrain-aware pass logic:** the pass/visibility decision must use **clearance** (Earth elevation above the terrain horizon), so `PassStarted`/`PassComplete` become **Earthrise/Earthset over real terrain** without changing TrackLogic's state machine. Rename the event text, or add `EarthRise`/`EarthSet` events if that's cleaner.
3. **Elevation display mapping** (labelled exaggeration): the commanded mount elevation is `clamp(EL_OFFSET + EL_SCALE × earth_el_raw, 0, 90)`, defaults `EL_OFFSET = 45`, `EL_SCALE = 6` (params). The same mapping produces the printed horizon ring (S4), so the pointer visibly drops behind the paper ridge at Earthset. Choose the least invasive way to pass both clearance (for logic) and raw elevation (for pointing) through the existing ports: extend the port struct, or apply the mapping inside AntennaController. Document the choice.
4. **Azimuth centring:** set `MOUNT_ZERO_AZ_DEG` per site to the **mean Earth azimuth** over the window (Earth's band is about ±8°, well inside ±90°). The pipeline exports this value with the CSV.
5. Unit tests for `EphemerisTable` (load, interpolation, playback timing) and for the mapping.

### 7.4 Optional (X5): MPU6050
Only if everything else is done. The `imu-altitude-visualization` project in fprime-labs already has an MPU6050 → F´ → GDS path. Use it either for measured-vs-commanded elevation on the arm, or for roll/pitch slope compensation of the pointing (no magnetometer, so no heading). Pick one.

### 7.5 Hardware go/no-go
Sunday **11:00**: if the twin isn't reliable, record a clean video of it working and demo the software live. Don't sink more than about 5 h total into hardware.

## 8. Web app (`web/`)

- Vite + React + TypeScript; Canvas 2D for the panorama and timelines; three.js only for X3. No heavy UI framework; clean CSS, dark theme, high contrast, colour-blind-safe palette (Sun = amber, Earth = blue, both = green, neither = dark grey, plus patterns or labels, not colour alone). Keyboard accessible.
- Layout: header (T-Minus + one-line value prop) → site picker plus custom coords → epoch picker plus **slip slider** plus play controls → **countdown cards** (1 site, or 2–3 in compare mode) → **panorama** → **window timeline** → link badge (S1) → tabs: Validation · Method · About/Educator.
- Countdown format: `T-41:12:05 ☀ SUNSET`, `T-09:14:22 🌍 EARTHSET`; when a body is down, show `T+… since set · next rise in …`.
- Shareable state in the URL query (`?site=connecting-ridge&t=2027-03-12T00:00Z&cmp=malapert`).
- Data loading: fetch `sites.json`, then `site_<id>.json` lazily; cache in memory.
- Footer: data attribution (NASA LOLA/PGDA, JPL Horizons/NAIF SPICE, ESA Malargüe info), "Not an official NASA product", AI disclosure link.
- Deploy: Vercel, root `web/`, build `npm run build`, output `dist`. Get a hello-world deployed within the first hours and keep it green.

## 9. Milestones and timeline (ART)

| When | Milestone | Done when |
|---|---|---|
| Sat 11:00–12:00 | Repo, venv, Vite skeleton, Vercel deploy; start kernel + DEM downloads | Empty app live; downloads running |
| 12:00–14:00 | `ephem.py` + `validate_horizons.py` | Horizons deltas table generated |
| 14:00–17:00 | `dem.py` + `horizon.py` + tests | Connecting Ridge panorama plot looks plausible; tests pass |
| 17:00–18:00 | `metrics.py` + `stations.py` + `build.py` | JSON for all sites |
| 18:00–19:00 | `validate_published.py` | Published-vs-ours table |
| 19:00–23:00 | Web MVP: picker, slip slider, cards, panorama, timeline, compare | Deployed and usable |
| 23:00–00:00 | Bug pass, commit, deploy | **MVP v1 live** |
| Sun 00:00–06:00 | Sleep | — |
| 06:00–09:00 | F´ twin (§7) + printed horizon ring | Mount tracks Earth over a compressed 14-day window and stows at Earthset |
| 09:00–11:00 | Link badge, educator mode, custom coords polish, method/validation pages | Feature-complete |
| 11:00 | **Hardware go/no-go** | Decision |
| 11:00–16:00 | Polish, accessibility, performance, README/METHOD/VALIDATION | **Scope frozen at 16:00** |
| 16:00–19:00 | 30 s video (screen + mount), English subtitles | Uploaded |
| 19:00–21:00 | Project page (owner writes; Claude assists with text) | Complete |
| 21:00–23:30 | Rehearse, test links in incognito, **submit by 23:30** | Confirmation |

If local judging happens on Sunday afternoon, move the video and page work earlier.

## 10. Known gotchas

- **Azimuth/frame mismatch** between Skyfield altaz and the DEM ray azimuths: the #1 bug risk. Test it (§5.5).
- Longitude conventions: east-positive; DEM CRS vs ±180 vs 0–360; Horizons `SITE_COORD` takes **east longitude, latitude, altitude in km**.
- Time scales: inputs and outputs in **UTC**; Skyfield handles TDB internally.
- `moon_pa_de421_1900-2050.bpc` is valid to 2050, which is fine.
- DEM heights: confirm the reference radius (1737.4 km) and the units per product.
- Near the pole, rays cross the pole region; the great-circle march on the sphere handles that, but projecting into polar stereographic must use the file's CRS.
- Big downloads: check sizes first; never commit raw data.
- Don't present the ×6 elevation exaggeration as real: label it on the device, in the video and in the UI.

## 11. Copy snippets (reuse in the UI, README and page)

- Value prop: *"Pick a south-pole site and a date. T-Minus counts down to sunset and Earthset over real NASA LOLA terrain, and tells you whether Malargüe can still hear you."*
- Why: *"At the Moon's south pole the Sun and Earth skim the horizon. A ridge a few hundred meters away decides whether a lander has power, or a voice."*
- IM-2 beat: *"In March 2025, IM-2 landed tipped over in a spot the Sun couldn't reach, and ran about 12 hours and 45 minutes before its power ran out."*
- Hardware line: *"This is NASA JPL's F´ flight software pointing a lander antenna at Earth, and stopping when the terrain blocks it."*
