# AI use disclosure

This project was built by one person (Martín Mengo) during the NASA Space Apps Challenge 2026 (Buenos Aires), using **Claude Code** (Anthropic) as a coding assistant. The human sets the design, the data choices and the scope, and reviews the output; the AI writes and edits code and docs on request. Every claimed number comes from a script in this repo, not from the AI.

## Log

| Date/time (ART) | Task | AI contribution |
|---|---|---|
| 2026-11-14 11:00–12:00 | Repo setup | Scaffolded the Vite + React + TS app by hand (no generators); created the Python venv with pinned dependencies (date cutoff 2026-10-15, wheels only); wrote `pipeline/fetch_data.sh`; checked the PGDA product 78 and LOLA polar DEM products (sizes, units, reference radius) before downloading. |
| 2026-11-14 12:00–13:00 | Ephemeris + Horizons validation | Wrote `pipeline/ephem.py`, `sites.py`, `validate_horizons.py` and the frame tests. Found and fixed a 27 s leap-second offset in the time-grid builder. Added negative controls to the Horizons comparison so the sub-arcsecond agreement is shown to be real and not an artefact. |
| 2026-11-14 13:00–13:30 | DEM, horizon, metrics, stations, build | Wrote `dem.py`, `horizon.py`, `metrics.py`, `stations.py`, `build.py`, `plot_panorama.py` and the tests. Parsed the PGDA ROI shapefiles. Found that the tile-centre points for Malapert and Nobile Rim 1 were on slopes; switched them to the tile summits, with the reasoning recorded in `sites.py`. |
| 2026-11-14 13:30–15:00 | Sun definitions, published validation, web MVP | Added any/50%/full Sun definitions. Wrote `validate_published.py`: it extracts Bryant 2009's tables from the PDF, samples PGDA 69 at every point, adds an approximate-replication column, and generates one-line explanations by rule. Wrote the React MVP (cards, panorama, timeline, metrics, compare, slip slider, URL state). |
| 2026-11-14 15:00–17:00 | Link badge, custom points, tabs, educator mode | Implemented the owner's designs: the two-horizon link badge; browser-side ephemeris math with neighbourhood horizon grids (`export_browser.py`, `geo.ts`, `custom.ts`, `npm run test:geo` against Skyfield); the Validation/Method/About tabs using the owner's three-tier framing; educator mode, with the FAQ claims checked against the grid data. |
| 2026-11-15 13:00– | Video plan review + video tooling | Checked the owner's video plan against the shipped data: Earth's rate near the horizon, Earth phase at each event, station elevations, the Malapert 500 m point and the 500 m neighbour spreads. Wrote `pipeline/export_video.py` (real Earthset/Earthrise events), the S1 ridge render in `video/` (three.js, true scale), the frame server, `video/hw_antenna.py` and `video/horizon_ring.py`. |

## Generative AI in the video (ElevenLabs)

The submission video uses **ElevenLabs** generative AI for:

- **Voice:** Spanish narration, plus English narration for the 30 s global cut.
- **Music:** Eleven Music score.
- **Sound effects:** ElevenLabs Sound Effects.
- **Video clips:** Earth-to-Moon flight, the south-pole landscape, and an illustrative recreation of a tipped lander.

The AI clips are illustrative and are not derived from our data. The video's end card says "Voz e imágenes: IA (ElevenLabs)". The ridge Earthset/Earthrise scenes (S1) and the terrain scene (S2b) are rendered by our own code from our computed data. The antenna footage and its motor sound are real.
