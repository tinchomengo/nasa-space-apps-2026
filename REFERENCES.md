# References

## Data

| Data | Source | Use |
|---|---|---|
| LOLA 5 m/px south-pole site DEMs (Site01, 04, 06, 07, 11, 20v2, 23) | NASA PGDA product 78, <https://pgda.gsfc.nasa.gov/products/78>. Barker, M.K. et al. (2021), *Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions*, Planet. Space Sci. 203:105119, doi:10.1016/j.pss.2020.105119 | Near-field terrain horizon |
| LOLA GDR polar DEM `LDEM_75S_120M_FLOAT` | NASA PDS / LRO LOLA team, <https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/> | Far-field terrain horizon (to 150 km) |
| DE421 planetary ephemeris (`de421.bsp`) | NASA JPL / NAIF | Sun, Earth and Moon positions |
| Lunar frame kernels (`moon_080317.tf`, `pck00008.tpc`, `moon_pa_de421_1900-2050.bpc`) | NASA NAIF generic kernels, <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/> | MOON_ME (DE421) body-fixed frame |
| LOLA illumination and Earth-visibility maps (`AVGVISIB_*`, `*_EARTH`) | NASA PGDA product 69 (Mazarico et al.), <https://pgda.gsfc.nasa.gov/products/69>; files from <http://imbrium.mit.edu/EXTRAS/ILLUMINATION/> | Validation (method check) |
| JPL Horizons API | <https://ssd.jpl.nasa.gov/api/horizons.api> | Offline validation of our ephemeris (cached responses) |

Site numbering follows Mazarico, E. et al. (2011), *Illumination conditions of the lunar polar regions using LOLA topography*, Icarus 211(2):1066–1081, doi:10.1016/j.icarus.2010.10.030.

## Video assets

| Asset | Source | Licence | Use |
|---|---|---|---|
| `earth_daymap_5400.jpg` | NASA Visible Earth "Blue Marble Next Generation" (`world.topo.bathy.200412.3x5400x2700`), <https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg> | Public domain | Earth texture in the S1 ridge render (`video/`) |
| `earth_clouds_2048.png`, `earth_specular_2048.jpg`, `earth_normal_2048.jpg` | three.js r160 example assets (derived from NASA Blue Marble), <https://github.com/mrdoob/three.js/tree/r160/examples/textures/planets> | MIT (three.js) | Earth clouds, ocean glint and relief in S1 |

The texture files are copied from the author's earlier project `fprime-labs/detumble-sil` (`visualization/models/earth/`, with its NOTICE). Video narration, music, sound effects and three illustrative clips are AI-generated with ElevenLabs (see [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md)).

## Software libraries

### Python pipeline (offline only; pinned in `pipeline/requirements.txt`)

- Skyfield (MIT), jplephem (MIT), sgp4 (MIT)
- NumPy (BSD-3-Clause)
- rasterio (BSD-3-Clause) / GDAL (MIT)
- Matplotlib (PSF-based), pytest (MIT)

### Video tooling (`video/`, pinned in `video/package.json` + lockfile; `pyserial` pinned)

- three.js 0.160.0 (MIT)
- Vite (MIT)
- pyserial 3.5 (BSD-3-Clause)
- FFmpeg (LGPL/GPL; installed locally, used as a command-line tool, not redistributed)

### Web app (pinned in `web/package.json` + `package-lock.json`)

- React, React DOM (MIT)
- Vite, @vitejs/plugin-react (MIT)
- TypeScript (Apache-2.0)

## Pre-existing code

- `fprime-labs/iss-tracker` Pico firmware (`firmware/pico-tracker`, at commit 9b9b315; author's own project, built before the event, Apache-2.0). It runs **unmodified** on the antenna prototype. It is not copied into this repo. During the event we wrote `video/hw_antenna.py`, which drives that firmware over USB serial using its existing line protocol.
- The mount hardware (stepper azimuth, servo elevation) is from the same pre-existing project.
