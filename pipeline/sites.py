"""Curated landing sites. Status labels are 'as of Nov 2026'.

Coordinate sources:
- "pgda78-roi": PGDA product 78 publishes, per site, ROI polygons of regions with average
  illumination > 70% (`SiteNN_ROIs.tgz`), each with a representative X/Y point (polar
  stereographic m, R = 1737.4 km). We use the point of the LARGEST ROI. (Site01/04/07/11.)
- "lola120-local-summit": no ROI file is published for this site (Site06/23 return an error
  page) and the tile centre is an arbitrary point (Site23's sat on a flank, Site06's on a
  14.7° slope). We use the highest point of the LOLA 120 m DEM within 15 km of the PGDA tile
  centre (the nominal site). Display sites only; validation uses the exact published points.
- "published": coordinates published by the mission / agency (cited in `source`).
"""
from dataclasses import dataclass, field, asdict


@dataclass(frozen=True)
class Site:
    id: str
    name: str
    lat: float  # planetocentric, degrees
    lon: float  # east-positive, -180..180, degrees
    coord_source: str
    source: str
    why: str
    pgda_site: str | None = None  # PGDA product 78 tile id, if any
    tags: tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["tags"] = list(self.tags)
        return d


SITES: list[Site] = [
    Site(
        "connecting-ridge", "Shackleton Connecting Ridge", -89.4527, -137.1487,
        "pgda78-roi", "PGDA product 78 Site01 ROI (largest avg-illumination>70% region; PS x=-11287.5, y=-12167.5 m)",
        "Best long-term illumination near the pole; Blue Origin Blue Moon MK1 'Endurance' target "
        "(NET early 2027, as of Nov 2026).",
        pgda_site="Site01", tags=("south-pole",),
    ),
    Site(
        "shackleton-rim", "Shackleton rim", -89.7620, -157.0672,
        "pgda78-roi", "PGDA product 78 Site04 ROI (largest avg-illumination>70% region; PS x=-2812.5, y=-6647.5 m)",
        "Classic high-illumination rim of Shackleton crater.",
        pgda_site="Site04", tags=("south-pole",),
    ),
    Site(
        "peak-near-shackleton", "Peak near Shackleton", -88.8073, 123.7768,
        "pgda78-roi", "PGDA product 78 Site07 ROI (largest avg-illumination>70% region; PS x=30062.5, y=-20107.5 m)",
        "Chang'e-7 target region (launch slipped to 2027, as of Nov 2026).",
        pgda_site="Site07", tags=("south-pole",),
    ),
    Site(
        "de-gerlache-rim", "de Gerlache rim", -88.6683, -68.3758,
        "pgda78-roi", "PGDA product 78 Site11 ROI (largest avg-illumination>70% region; PS x=-37542.5, y=14882.5 m)",
        "Artemis IV candidate region (de Gerlache Rim 2), as of Nov 2026.",
        pgda_site="Site11", tags=("south-pole", "artemis-candidate"),
    ),
    Site(
        "malapert", "Malapert massif (summit)", -85.9883, 2.0625,
        "lola120-local-summit", "Highest LDEM_75S_120M point within 15 km of the PGDA Site23 tile centre (5172 m; 4.9 km from it)",
        "Earth almost always in view; Artemis candidate region.",
        pgda_site="Site23", tags=("south-pole", "artemis-candidate"),
    ),
    Site(
        "mons-mouton", "Mons Mouton (IM-2 landing site)", -84.7906, 29.1957,
        "published", "Intuitive Machines IM-2 landing site (6 Mar 2025)",
        "IM-2 landed tipped over and ran about 12 h 45 min before its power ran out; "
        "Artemis candidate region.",
        pgda_site="Site20v2", tags=("south-pole", "artemis-candidate"),
    ),
    Site(
        "nobile-rim-1", "Nobile Rim 1 (local summit)", -85.2305, 36.5706,
        "lola120-local-summit", "Highest LDEM_75S_120M point within 15 km of the PGDA Site06 tile centre (6799 m; 6.6 km from it)",
        "Artemis candidate region; Griffin-1 area.",
        pgda_site="Site06", tags=("south-pole", "artemis-candidate"),
    ),
    Site(
        "chandrayaan-3", "Chandrayaan-3 (Shiv Shakti point)", -69.373, 32.319,
        "published", "ISRO Chandrayaan-3 landing site (23 Aug 2023)",
        "'Near south pole' contrast: far from the polar DEMs, smooth-sphere horizon.",
        tags=("contrast",),
    ),
    Site(
        "apollo-11", "Apollo 11 (Tranquility Base)", 0.6741, 23.4730,
        "published", "NASA NSSDCA Apollo 11 landing site",
        "Equatorial contrast: the Sun climbs high and Earth hangs almost still.",
        tags=("contrast",),
    ),
    Site(
        "apollo-17", "Apollo 17 (Taurus-Littrow)", 20.1908, 30.7717,
        "published", "NASA NSSDCA Apollo 17 landing site",
        "Equatorial contrast.",
        tags=("contrast",),
    ),
]

BY_ID: dict[str, Site] = {s.id: s for s in SITES}


# Validation-only points (published coordinates + values) live in validate_published.py.
