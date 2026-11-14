const REPO = 'https://github.com/tinchomengo/nasa-space-apps-2026/blob/main'

export function MethodTab() {
  return (
    <div className="prose">
      <h3>In plain language</h3>
      <p>
        For each site we work out where the Sun and Earth are in the lunar sky, every 10 minutes from November 2026 to
        January 2029. We then trace the real skyline around the site from NASA's laser-altimeter terrain maps (LOLA). When
        the Sun is above that skyline the lander has power; when Earth is above it, the lander can talk directly to Earth.
        The countdowns are the time until the next crossing of that skyline.
      </p>

      <h3>What the defaults mean</h3>
      <table className="metrics left">
        <tbody>
          <tr>
            <th scope="row">☀ Sun up</th>
            <td>At least half of the Sun's disc is above the terrain (its centre clears the skyline). Also computed: any part, full disc.</td>
          </tr>
          <tr>
            <th scope="row">🌍 Earth visible</th>
            <td>Earth's centre is above the terrain. Also computed: any part, full disc (Earth looks about 2° wide).</td>
          </tr>
          <tr>
            <th scope="row">📡 Link possible</th>
            <td>
              Earth is above the lunar terrain <em>and</em> the Moon is more than 10° above the horizon at ESA Malargüe
              (Argentina) or a NASA Deep Space Network station (Goldstone, Madrid, Canberra). Two horizons, one link.
            </td>
          </tr>
          <tr>
            <th scope="row">Observer</th>
            <td>2 m above the ground (a mast or antenna). No atmospheric refraction: the Moon has no air.</td>
          </tr>
        </tbody>
      </table>

      <h3>Data</h3>
      <ul>
        <li>Terrain: NASA PGDA product 78, LOLA 5 m/pixel maps of south-pole sites (Barker et al. 2021), plus the LOLA 120 m polar map out to 150 km.</li>
        <li>Positions: JPL DE421 ephemeris and the lunar body-fixed frame from NAIF SPICE kernels, computed with Skyfield. Earth's wobble in the lunar sky (libration) is included.</li>
        <li>Ground stations: ESA Malargüe DSA-3 and the three NASA DSN complexes.</li>
      </ul>

      <h3>How the skyline is built</h3>
      <p>
        For 720 directions around the site, we walk outward along the curved lunar surface, from 5 m steps near the lander
        up to 200 m steps at 150 km. At each step we read the terrain height and measure the elevation angle from a 2 m
        mast. The skyline in that direction is the highest angle found. The Moon's curvature is computed exactly.
      </p>

      <h3>Custom points</h3>
      <p>
        Around each polar site there is a 10 × 10 km grid of points 500 m apart, each with its own skyline. The Sun and
        Earth positions for any point are computed in your browser from precomputed vectors; they match the full
        calculation to within 0.0001°. Outside these boxes we use a smooth sphere and say so.
      </p>

      <h3>Limitations</h3>
      <ul>
        <li>Terrain beyond 150 km is ignored; uncertainty in the terrain maps is not yet propagated.</li>
        <li>The horizon is treated as straight across the Sun's and Earth's discs when computing the visible fraction.</li>
        <li>A summit is not always best for Earth: at the Malapert summit, its own rounded shoulder hides Earth about 20% of the time from a 2 m mast.</li>
        <li>The lander is a point: its tilt and self-shadowing are not modelled.</li>
      </ul>
      <p className="muted">
        Technical detail: <a href={`${REPO}/docs/METHOD.md`}>METHOD.md</a> · code: <a href="https://github.com/tinchomengo/nasa-space-apps-2026">GitHub</a>
      </p>
    </div>
  )
}
