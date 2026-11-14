import type { SiteData } from '../lib/data'
import { windowStats } from '../lib/sky'
import { DAY, fmtPct } from '../lib/format'

/** Window metrics side by side for each site (M7). */
export function Metrics({ sites, t, windowDays = 14 }: { sites: SiteData[]; t: number; windowDays?: number }) {
  const rows = sites.map((s) => ({ s, w: windowStats(s, t - windowDays * DAY, t + windowDays * DAY) }))
  return (
    <section className="panel" aria-label="Window metrics">
      <div className="panel-head">
        <strong>Window metrics</strong> · ±{windowDays} days around the selected time
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th scope="col">Site</th>
              <th scope="col">Sunlit</th>
              <th scope="col">Earth visible</th>
              <th scope="col">Both</th>
              <th scope="col">Longest darkness</th>
              <th scope="col">Longest DTE gap</th>
              <th scope="col">Full-span sunlit / Earth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, w }) => (
              <tr key={s.meta.id}>
                <th scope="row">{s.meta.name}</th>
                <td>{w ? fmtPct(w.sunlitPct) : '—'}</td>
                <td>{w ? fmtPct(w.earthPct) : '—'}</td>
                <td>{w ? fmtPct(w.bothPct) : '—'}</td>
                <td>{w ? `${w.longestDarkH.toFixed(0)} h` : '—'}</td>
                <td>{w ? `${w.longestDteGapH.toFixed(0)} h` : '—'}</td>
                <td className="muted">
                  {fmtPct(s.stats.sunlit_pct as number)} / {fmtPct(s.stats.earth_visible_pct as number)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
