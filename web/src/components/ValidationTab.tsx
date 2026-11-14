import { useEffect, useState } from 'react'

const REPO = 'https://github.com/tinchomengo/nasa-space-apps-2026/blob/main'

interface HorizonsRow { name: string; body: string; n: number; max_sep: number }
interface Control { perturbation: string; max_sep: number }
interface PublishedRow {
  source: string; point: string; lat: number; lon: number; metric: string
  published: number; ours: number; pgda_at_point?: number; pgda_max2km?: number
}
interface PgdaRow {
  point: string; pgda_sun: number; ours_sun: number; rep_sun: number; pgda120_sun: number
  pgda_earth: number; ours_earth: number; rep_earth: number; pgda120_earth: number
}
interface Validation {
  horizons: { overall: { n: number; max_sep: number; mean_sep: number }; rows: HorizonsRow[]; controls: Control[]; epochs: string[] }
  published: {
    rows: PublishedRow[]
    pgda69: PgdaRow[]
    no_coordinates: { source: string; point: string; metric: string; published: number; note: string }[]
    summary: {
      n_points: number
      replication_sun_median_abs: number; replication_earth_median_abs: number
      ours_vs_pgda_at_published_points_median_abs: number; n_published_any_part: number
      published_vs_pgda_best2km_median_abs: number; published_vs_pgda_best2km_max_abs: number
    }
  }
}

const arcsec = (deg: number) => `${(deg * 3600).toFixed(3)}″`
const p1 = (x: number) => x.toFixed(1)

export function ValidationTab() {
  const [v, setV] = useState<Validation | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/validation.json`)
      .then((r) => r.json())
      .then(setV)
      .catch((e) => setErr(String(e)))
  }, [])
  if (err) return <p className="error">{err}</p>
  if (!v) return <p className="muted">Loading validation…</p>
  const h = v.horizons
  const s = v.published.summary
  const anyPart = v.published.rows.filter((r) => r.metric.includes('any part') && r.pgda_max2km !== undefined)

  return (
    <div className="prose">
      <p className="muted">
        Every number on this page comes from the validation scripts in the repository (<code>pipeline/validate_*.py</code>).
        Nothing was tuned to match. Full tables: <a href={`${REPO}/docs/VALIDATION.md`}>VALIDATION.md</a>.
      </p>

      <h3>1 · Sun and Earth positions vs JPL Horizons</h3>
      <p>
        <strong className="kpi">{arcsec(h.overall.max_sep)}</strong> maximum difference over {h.overall.n} comparisons
        (7 sites × Sun and Earth × {h.epochs.length} days, hourly). Horizons uses the newer DE441 ephemeris; we use DE421.
        Sensitivity checks show the comparison would catch real errors:{' '}
        {h.controls.map((c, i) => (
          <span key={c.perturbation}>
            {i > 0 ? ', ' : ''}
            {c.perturbation} → {arcsec(c.max_sep)}
          </span>
        ))}
        .
      </p>

      <h3>2 · Terrain visibility vs NASA's own maps (PGDA product 69)</h3>
      <p>
        At the same points, our long-run Sun and Earth visibility differs from NASA PGDA 69 by a median of{' '}
        <strong className="kpi">{p1(s.ours_vs_pgda_at_published_points_median_abs)} percentage points</strong> (
        {s.n_published_any_part} comparisons). Re-running our method on the same 120 m terrain map that PGDA uses (
        {s.n_points} points) gives a median difference of {p1(s.replication_sun_median_abs)} points for the Sun and{' '}
        {p1(s.replication_earth_median_abs)} for Earth.
      </p>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th scope="col">Point</th>
              <th scope="col">PGDA Sun</th>
              <th scope="col">Ours Sun</th>
              <th scope="col">PGDA Earth</th>
              <th scope="col">Ours Earth</th>
              <th scope="col">Same-DEM rerun Sun / Earth (PGDA 120 m)</th>
            </tr>
          </thead>
          <tbody>
            {v.published.pgda69.map((r) => (
              <tr key={r.point}>
                <th scope="row">{r.point}</th>
                <td>{p1(r.pgda_sun)}%</td>
                <td>{p1(r.ours_sun)}%</td>
                <td>{p1(r.pgda_earth)}%</td>
                <td>{p1(r.ours_earth)}%</td>
                <td className="muted">
                  {p1(r.rep_sun)} / {p1(r.rep_earth)} ({p1(r.pgda120_sun)} / {p1(r.pgda120_earth)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        PGDA counts a body as visible if any part of its disc shows; these columns use the same definition, with our 2 m
        mast and 5 m terrain. Where our value is higher, the finer terrain resolves ridge crests that the coarser grid smooths away.
      </p>

      <h3>3 · Published studies (Bryant 2009, Bussey 2010)</h3>
      <p>
        These papers used older terrain maps: a 2006 Goldstone radar DEM and Kaguya data. Those place features hundreds of metres to a few
        kilometres away from where NASA's LOLA puts them, so their exact coordinates land on different terrain in LOLA, and
        visibility there changes a lot. Searching within 2 km of each published point, the best LOLA location (PGDA 69)
        comes within a median of <strong>{p1(s.published_vs_pgda_best2km_median_abs)} points</strong> of the published value
        (max {p1(s.published_vs_pgda_best2km_max_abs)}).
      </p>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th scope="col">Point</th>
              <th scope="col">Metric (any part of disc)</th>
              <th scope="col">Published</th>
              <th scope="col">Best LOLA point ≤ 2 km</th>
              <th scope="col">At the exact coordinates: PGDA / ours</th>
            </tr>
          </thead>
          <tbody>
            {anyPart.map((r) => (
              <tr key={r.point + r.metric}>
                <th scope="row">{r.point}</th>
                <td>{r.metric.startsWith('Sun') ? '☀ Sun' : '🌍 Earth'}</td>
                <td>{p1(r.published)}%</td>
                <td>{p1(r.pgda_max2km!)}%</td>
                <td className="muted">
                  {p1(r.pgda_at_point!)}% / {p1(r.ours)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Without usable coordinates (listed, not compared):{' '}
        {v.published.no_coordinates.map((r) => `${r.source.split(',')[0]}: ${r.point} ${p1(r.published)}%`).join(' · ')}.
        Our combined "Sun and Earth" metric has no published reference.
      </p>
    </div>
  )
}
