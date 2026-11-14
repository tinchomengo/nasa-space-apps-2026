"""Curated landing sites. Status labels are 'as of Nov 2026'.

Coordinate sources:
- "pgda78-roi": PGDA product 78 publishes, per site, ROI polygons of regions with average
  illumination > 70% (`SiteNN_ROIs.tgz`), each with a representative X/Y point (polar
  stereographic m, R = 1737.4 km). We use the point of the LARGEST ROI. (Site01/04/07/11.)
- "pgda78-tile-centre": no ROI file is published for this site (Site06/20v2/23 return an error
  page), so we use the centre of its 5 m/px GeoTIFF tile, converted with the file's own CRS.
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
        # FLAG: the tile centre sits on a ~14.7° slope with a 12.8° horizon 100 m away (not a
        # plausible landing point). "Highest point with slope < 8° within 2 km" was tried and
        # rejected (it lands on the circle edge, still climbing). Owner to decide a coordinate.
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


# --- Validation-only points (not shown as display sites) -------------------------------
# Published studies report values at specific points. validate_published.py evaluates at
# EXACTLY these coordinates, not at our display-site points. lat/lon None = not yet sourced.

@dataclass(frozen=True)
class ValidationPoint:
    id: str
    label: str
    lat: float | None
    lon: float | None
    source: str
    note: str = ""


VALIDATION_POINTS: list[ValidationPoint] = [
    ValidationPoint("bussey-A", "Bussey 2010 point A", -89.68, -166.0, "Bussey et al. 2010 (Icarus 208:558)", "81% illuminated, 2020"),
    ValidationPoint("bussey-B", "Bussey 2010 point B", -89.44, -141.8, "Bussey et al. 2010 (Icarus 208:558)", "82% illuminated, 2020"),
    ValidationPoint("bussey-D", "Bussey 2010 point D", -88.79, 124.5, "Bussey et al. 2010 (Icarus 208:558)", "86% illuminated, 2020"),
    ValidationPoint("glaser-CR1", "Gläser 2014 CR1", None, None, "Gläser et al. 2014 (Icarus 243:78)", "TODO: coordinates from the paper"),
    ValidationPoint("bryant-B1", "Bryant 2009 ridge B1", None, None, "Bryant 2009, JPL IPN PR 42-176", "TODO: coordinates from the paper"),
    ValidationPoint("kumari-007", "Kumari 2022 Site 007", None, None, "Kumari et al. 2022 (PSJ)", "TODO: coordinates from the paper"),
    ValidationPoint("kumari-011", "Kumari 2022 Site 011", None, None, "Kumari et al. 2022 (PSJ)", "TODO: coordinates from the paper"),
]
