# T-Minus: Mission Clock

**Live demo: <https://tminus-lunar.vercel.app>**

*Pick a south-pole site and a date. T-Minus counts down to sunset and Earthset over real NASA LOLA terrain, and tells you whether Malargüe can still hear you.*

NASA Space Apps Challenge 2026, **Lunar Landing Site Navigator**, Buenos Aires local event.

## What it does

- **Countdowns** for each site: `T-7d 17:07:00 ☀ SUNSET` and `🌍 EARTHSET`, measured against the real terrain skyline, with green / amber / red margins.
- **Link badge** using two horizons: Earth must be above the lunar terrain, *and* the Moon must be above the 10° mask at ESA Malargüe (Argentina) or a NASA DSN station.
- **Date picker and ±60-day slip slider** that recompute everything instantly, plus playback.
- **Horizon panorama** centred on Earth's mean direction, a window timeline (Sun / Earth / both), window metrics, and side-by-side comparison of up to 3 sites.
- **Explore:** a 10 × 10 km map around each polar site with a sunlit / Earth / both heatmap. Click any point to compute its countdowns in the browser. Custom lat/lon is also supported.
- **Validation, Method, About** tabs and an **educator mode** with plain-language explanations.

## Validation (details in [docs/VALIDATION.md](docs/VALIDATION.md))

1. **Sun and Earth positions vs JPL Horizons:** maximum difference 0.04″ over 1050 comparisons.
2. **Terrain method vs NASA PGDA product 69:** our method run on PGDA's own 120 m DEM reproduces it with a median difference of 1.3 percentage points (Sun) and 1.2 (Earth). Our default 5 m DEM with a 2 m mast differs from PGDA's surface-level map mainly because of the mast height (Connecting Ridge breakdown).
3. **Published studies (Bryant 2009, Bussey 2010):** their older DEMs shift terrain by hundreds of metres to a few km relative to LOLA. The best LOLA point within 2 km comes within a median of 6.4 points of their values.

## Layout

- `pipeline/`: Python offline precompute (Skyfield + LOLA DEMs → JSON and binary). No runtime API calls.
- `web/`: Vite + React + TypeScript front end. It reads the precomputed data in `web/public/data/`.
- `docs/`: [method](docs/METHOD.md), [validation](docs/VALIDATION.md), [AI disclosure](docs/AI_DISCLOSURE.md).

## Run

```bash
# Pipeline (Python 3.12)
python3.12 -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: --uploaded-prior-to 2026-10-15T00:00:00Z -r pipeline/requirements.txt
pipeline/fetch_data.sh                              # ~1 GB of kernels + DEMs + PGDA maps into data/ (gitignored)
.venv/bin/python -m pytest pipeline/tests           # frame, horizon and metric tests
.venv/bin/python -m pipeline.build                  # -> web/public/data/*.json
.venv/bin/python -m pipeline.export_browser         # ephemeris vectors + Explore grids
.venv/bin/python -m pipeline.validate_horizons      # cached Horizons comparison
.venv/bin/python -m pipeline.validate_published     # PGDA 69 + published values

# Web
cd web && npm ci && npm run dev
npm run test:geo                                    # browser math vs Skyfield
```

See [REFERENCES.md](REFERENCES.md) for data sources and libraries, and [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md) for AI use.
Not an official NASA product.
