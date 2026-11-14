"""Curated landing sites. Status labels are 'as of Nov 2026'.

Coordinate sources:
- "pgda78-tile-centre": centre of the PGDA product 78 5 m/px GeoTIFF tile for that site,
  converted with the file's own CRS (polar stereographic, R = 1737.4 km). PGDA does not
  publish a site-centre point; this is PROVISIONAL until refined from the ROI shapefiles.
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
        "connecting-ridge", "Shackleton Connecting Ridge", -89.4632, -137.4896,
        "pgda78-tile-centre", "PGDA product 78 Site01 tile centre",
        "Best long-term illumination near the pole; Blue Origin Blue Moon MK1 'Endurance' target "
        "(NET early 2027, as of Nov 2026).",
        pgda_site="Site01", tags=("south-pole",),
    ),
    Site(
        "shackleton-rim", "Shackleton rim", -89.7668, -171.8699,
        "pgda78-tile-centre", "PGDA product 78 Site04 tile centre",
        "Classic high-illumination rim of Shackleton crater.",
        pgda_site="Site04", tags=("south-pole",),
    ),
    Site(
        "peak-near-shackleton", "Peak near Shackleton", -88.8110, 123.6901,
        "pgda78-tile-centre", "PGDA product 78 Site07 tile centre",
        "Chang'e-7 target region (launch slipped to 2027, as of Nov 2026).",
        pgda_site="Site07", tags=("south-pole",),
    ),
    Site(
        "de-gerlache-rim", "de Gerlache rim", -88.6834, -67.9321,
        "pgda78-tile-centre", "PGDA product 78 Site11 tile centre",
        "Artemis IV candidate region (de Gerlache Rim 2), as of Nov 2026.",
        pgda_site="Site11", tags=("south-pole", "artemis-candidate"),
    ),
    Site(
        "malapert", "Malapert massif", -85.9948, -0.2358,
        "pgda78-tile-centre", "PGDA product 78 Site23 tile centre",
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
        "nobile-rim-1", "Nobile Rim 1", -85.4381, 37.3667,
        "pgda78-tile-centre", "PGDA product 78 Site06 tile centre",
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
