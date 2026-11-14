import { useEffect, useState } from 'react'

const REPO = 'https://github.com/tinchomengo/nasa-space-apps-2026/blob/main'

interface Control { perturbation: string; max_sep: number }
interface PublishedRow {
  source: string; point: string; lat: number; lon: number; metric: string
  published: number; ours: number; pgda_at_point?: number; pgda_max2km?: number
}
interface PgdaRow {
  id: string; point: string; pgda_sun: number; ours_sun: number; rep_sun: number; pgda120_sun: number
  pgda_earth: number; ours_earth: number; rep_earth: number; pgda120_earth: number
}
interface Med { median: number | null; max: number | null; n: number; excluded_both_zero: number }
interface Validation {
  horizons: { overall: { n: number; max_sep: number }; controls: Control[]; epochs: string[] }
  published: {
    rows: PublishedRow[]
    pgda69: PgdaRow[]
    no_coordinates: { source: string; point: string; metric: string; published: number; note: string }[]
    summary: {
      method_check: { sun: Med; earth: Med }
      curated_vs_pgda: { sun: Med; earth: Med }
      published_points_vs_pgda: { sun: Med; earth: Med }
      published_vs_best2km: Med
    }
    connecting_ridge_breakdown: {
      definition: string; period: string; steps: { label: string; sun: number; earth: number }[]; reading: string
      heights: { h_m: number; sun: number; earth: number }[]; ground_note: string
    }
    glaser: { source: string; two_m_pct: number; ten_m_pct: number; note: string }
  }
}

const arcsec = (deg: number) => `${(deg * 3600).toFixed(3)}″`
const p1 = (x: number | null) => (x === null ? '—' : x.toFixed(1))
const nNote = (m: Med) => `n = ${m.n}${m.excluded_both_zero ? `; ${m.excluded_both_zero} rows with both values 0% excluded` : ''}`
const isPub = (id: string) => id.startsWith('bryant') || id.startsWith('bussey')

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
  const cr = v.published.connecting_ridge_breakdown
  const g = v.published.glaser
  const anyPart = v.published.rows.filter((r) => r.metric.includes('any part') && r.pgda_max2km !== undefined)
  const curated = v.published.pgda69.filter((r) => !isPub(r.id))

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

      <h3>2 · Terrain method vs NASA's own maps (PGDA product 69)</h3>
      <p>
        Running our skyline method on the <em>same</em> 120 m terrain map that NASA used for PGDA 69 reproduces its long-run
        visibility with a median difference of{' '}
        <strong className="kpi">{p1(s.method_check.sun.median)} points for the Sun</strong> ({nNote(s.method_check.sun)}) and{' '}
        <strong className="kpi">{p1(s.method_check.earth.median)} for Earth</strong> ({nNote(s.method_check.earth)}).
      </p>
      <p>
        Our default numbers are a different configuration: 5 m terrain and a 2 m mast, where PGDA uses a 60 m map at
        ground level. Against PGDA, the median difference is {p1(s.curated_vs_pgda.sun.median)} points (Sun) and{' '}
        {p1(s.curated_vs_pgda.earth.median)} (Earth) at our curated sites ({nNote(s.curated_vs_pgda.sun)}), and{' '}
        {p1(s.published_points_vs_pgda.sun.median)} (Sun, {nNote(s.published_points_vs_pgda.sun)}) and{' '}
        {p1(s.published_points_vs_pgda.earth.median)} (Earth, {nNote(s.published_points_vs_pgda.earth)}) at the Bryant
        and Bussey points. The breakdown below shows where the curated-site gap comes from.
      </p>

      <h4>Connecting Ridge: one change at a time ({cr.definition})</h4>
      <div className="table-scroll">
        <table className="metrics wrap">
          <thead>
            <tr>
              <th scope="col">Configuration</th>
              <th scope="col">☀ Sun</th>
              <th scope="col">🌍 Earth</th>
            </tr>
          </thead>
          <tbody>
            {cr.steps.map((st) => (
              <tr key={st.label}>
                <th scope="row">{st.label}</th>
                <td>{p1(st.sun)}%</td>
                <td>{p1(st.earth)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{cr.reading}</p>

      <div className="table-scroll">
        <table className="metrics compact" aria-label="Observer height sensitivity at Connecting Ridge">
          <thead>
            <tr>
              <th scope="col">Mast height (5 m DEM)</th>
              {cr.heights.map((x) => (
                <th scope="col" key={x.h_m} className={x.h_m === 2 ? 'hl' : undefined}>{x.h_m} m</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">☀ Sun</th>
              {cr.heights.map((x) => (
                <td key={x.h_m} className={x.h_m === 2 ? 'hl' : undefined}>{p1(x.sun)}%</td>
              ))}
            </tr>
            <tr>
              <th scope="row">🌍 Earth</th>
              {cr.heights.map((x) => (
                <td key={x.h_m} className={x.h_m === 2 ? 'hl' : undefined}>{p1(x.earth)}%</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p>{cr.ground_note.replace('->', '→').replace('->', '→')}</p>

      <h4>Curated sites</h4>
      <div className="table-scroll">
        <table className="metrics wrap">
          <thead>
            <tr>
              <th scope="col">Site</th>
              <th scope="col">PGDA 60 m Sun / Earth</th>
              <th scope="col">Ours (5 m, 2 m mast) Sun / Earth</th>
              <th scope="col">PGDA 120 m Sun / Earth</th>
              <th scope="col">Our method on 120 m Sun / Earth</th>
            </tr>
          </thead>
          <tbody>
            {curated.map((r) => (
              <tr key={r.point}>
                <th scope="row">{r.point}</th>
                <td>{p1(r.pgda_sun)} / {p1(r.pgda_earth)}</td>
                <td>{p1(r.ours_sun)} / {p1(r.ours_earth)}</td>
                <td>{p1(r.pgda120_sun)} / {p1(r.pgda120_earth)}</td>
                <td>{p1(r.rep_sun)} / {p1(r.rep_earth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">All values: % of time with any part of the disc visible (PGDA's definition), 18.6-year cycle.</p>

      <h3>3 · Published studies</h3>
      <p>
        Bryant 2009 and Bussey 2010 used older terrain maps: a 2006 Goldstone radar DEM and Kaguya data. Those place
        features hundreds of metres to a few kilometres away from where NASA's LOLA puts them, so their exact
        coordinates land on different terrain in LOLA, and visibility there changes a lot. Searching within 2 km of each
        published point, the best LOLA location (PGDA 69) comes within a median of{' '}
        <strong>{p1(s.published_vs_best2km.median)} points</strong> of the published value (max{' '}
        {p1(s.published_vs_best2km.max)}, {nNote(s.published_vs_best2km)}).
      </p>
      <div className="table-scroll">
        <table className="metrics wrap">
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
                <td className="muted">{p1(r.pgda_at_point!)}% / {p1(r.ours)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>{g.source}: different point, consistency only.</strong> 2 m mast: ours{' '}
        {p1(cr.heights.find((x) => x.h_m === 2)?.sun ?? null)}% vs {g.two_m_pct}%; 10 m: ours{' '}
        {p1(cr.heights.find((x) => x.h_m === 10)?.sun ?? null)}% vs {g.ten_m_pct}%. {g.note}
      </p>
      <p className="muted small">
        Without usable coordinates (listed, not compared):{' '}
        {v.published.no_coordinates.map((r) => `${r.source.split(',')[0]}: ${r.point} ${p1(r.published)}%`).join(' · ')}.
        Our combined "Sun and Earth" metric has no published reference.
      </p>
    </div>
  )
}
