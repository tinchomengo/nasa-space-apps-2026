# References

## Data

| Data | Source | Use |
|---|---|---|
| LOLA 5 m/px south-pole site DEMs (Site01, 04, 06, 07, 11, 20v2, 23) | NASA PGDA product 78, <https://pgda.gsfc.nasa.gov/products/78>. Barker, M.K. et al. (2021), *Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions*, Planet. Space Sci. 203:105119, doi:10.1016/j.pss.2020.105119 | Near-field terrain horizon |
| LOLA GDR polar DEM `LDEM_75S_120M_FLOAT` | NASA PDS / LRO LOLA team, <https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/> | Far-field terrain horizon (to 150 km) |
| DE421 planetary ephemeris (`de421.bsp`) | NASA JPL / NAIF | Sun, Earth and Moon positions |
| Lunar frame kernels (`moon_080317.tf`, `pck00008.tpc`, `moon_pa_de421_1900-2050.bpc`) | NASA NAIF generic kernels, <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/> | MOON_ME (DE421) body-fixed frame |
| JPL Horizons API | <https://ssd.jpl.nasa.gov/api/horizons.api> | Offline validation of our ephemeris (cached responses) |

Site numbering follows Mazarico, E. et al. (2011), *Illumination conditions of the lunar polar regions using LOLA topography*, Icarus 211(2):1066–1081, doi:10.1016/j.icarus.2010.10.030.

## Software libraries

### Python pipeline (offline only; pinned in `pipeline/requirements.txt`)

- Skyfield (MIT), jplephem (MIT), sgp4 (MIT)
- NumPy (BSD-3-Clause)
- rasterio (BSD-3-Clause) / GDAL (MIT)
- Matplotlib (PSF-based), pytest (MIT)

### Web app (pinned in `web/package.json` + `package-lock.json`)

- React, React DOM (MIT)
- Vite, @vitejs/plugin-react (MIT)
- TypeScript (Apache-2.0)

## Pre-existing code

- `fprime-labs/iss-tracker` (author's own project, built before the event, Apache-2.0). It is imported in one clearly labelled commit under `flight/`. All later changes are dated commits made during the event.
- NASA JPL F´ (F Prime) flight software framework, Apache-2.0, <https://github.com/nasa/fprime> (submodule of the above).
