# T-Minus: Mission Clock

*Pick a south-pole site and a date. T-Minus counts down to sunset and Earthset over real NASA LOLA terrain, and tells you whether Malargüe can still hear you.*

NASA Space Apps Challenge 2026, **Lunar Landing Site Navigator**, Buenos Aires local event. Work in progress.

## Layout

- `pipeline/`: Python offline precompute (Skyfield + LOLA DEMs → JSON). No runtime API calls.
- `web/`: Vite + React + TypeScript front end. It reads the precomputed JSON in `web/public/data/`.
- `docs/`: method, validation, AI disclosure.

## Run

```bash
# Pipeline (Python 3.12)
python3.12 -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: --uploaded-prior-to 2026-10-15T00:00:00Z -r pipeline/requirements.txt
pipeline/fetch_data.sh          # ~700 MB of kernels + DEMs into data/ (gitignored)

# Web
cd web && npm ci && npm run dev
```

See [REFERENCES.md](REFERENCES.md) for data sources and libraries, and [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md) for AI use.
Not an official NASA product.
