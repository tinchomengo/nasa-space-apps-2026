# AI use disclosure

This project was built by one person (Martín Mengo) during the NASA Space Apps Challenge 2026 (Buenos Aires), using **Claude Code** (Anthropic) as a coding assistant. The human sets the design, the data choices and the scope, and reviews the output; the AI writes and edits code and docs on request. Every claimed number comes from a script in this repo, not from the AI.

## Log

| Date/time (ART) | Task | AI contribution |
|---|---|---|
| 2026-11-14 11:00–12:00 | Repo setup | Scaffolded the Vite + React + TS app by hand (no generators); created the Python venv with pinned dependencies (date cutoff 2026-10-15, wheels only); wrote `pipeline/fetch_data.sh`; checked the PGDA product 78 and LOLA polar DEM products (sizes, units, reference radius) before downloading. |
| 2026-11-14 12:00–13:00 | Ephemeris + Horizons validation | Wrote `pipeline/ephem.py`, `sites.py`, `validate_horizons.py` and the frame tests. Found and fixed a 27 s leap-second offset in the time-grid builder. Added negative controls to the Horizons comparison so the sub-arcsecond agreement is shown to be real and not an artefact. |
