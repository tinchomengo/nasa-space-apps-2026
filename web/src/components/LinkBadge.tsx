import type { SiteData, StationsData } from '../lib/data'
import { human } from '../lib/format'

/** Moon elevation (deg) at a station at time t, linear in the hourly series. */
function moonEl(st: StationsData, k: number, t: number): number | null {
  const x = (t - st.meta.t0) / st.meta.stepSec
  const arr = st.stations[k].moonEl
  if (x < 0 || x > arr.length - 1) return null
  const i = Math.min(Math.floor(x), arr.length - 2)
  return arr[i] + (arr[i + 1] - arr[i]) * (x - i)
}

function earthClearAt(site: SiteData, t: number): number | null {
  const h = site.hourly
  const x = (t - h.t0) / h.stepSec
  if (x < 0 || x > h.earthClear.length - 1) return null
  const i = Math.min(Math.floor(x), h.earthClear.length - 2)
  return h.earthClear[i] + (h.earthClear[i + 1] - h.earthClear[i]) * (x - i)
}

/** Next hourly sample (after t) where the link condition flips to `want`; null if none within ~60 d. */
function nextFlip(site: SiteData, st: StationsData, t: number, want: boolean): number | null {
  const step = site.hourly.stepSec
  for (let k = 1; k <= 24 * 60; k++) {
    const tt = t + k * step
    const ec = earthClearAt(site, tt)
    if (ec === null) return null
    const any = st.stations.some((_, i) => (moonEl(st, i, tt) ?? -90) > st.meta.mask_deg)
    if ((ec > 0 && any) === want) return tt
  }
  return null
}

/**
 * Two-horizon link model (S1): DTE possible = Earth's centre above the lunar TERRAIN at the site
 * AND the Moon above the station mask at one or more ground stations.
 */
export function LinkBadge({ site, stations, t }: { site: SiteData; stations: StationsData; t: number }) {
  const ec = earthClearAt(site, t)
  if (ec === null) return null
  const per = stations.stations.map((s, i) => ({ s, el: moonEl(stations, i, t) ?? -90 }))
  const hearing = per.filter((p) => p.el > stations.meta.mask_deg)
  const terrainOk = ec > 0
  const ok = terrainOk && hearing.length > 0
  const flip = nextFlip(site, stations, t, !ok)
  const reason = !terrainOk
    ? 'Earth is behind the lunar terrain'
    : hearing.length === 0
      ? `no station sees the Moon above ${stations.meta.mask_deg}°`
      : null

  return (
    <div className={`link ${ok ? 'link-ok' : 'link-no'}`} role="status">
      <div className="link-head">
        <span className="link-icon" aria-hidden="true">{ok ? '📡' : '⛔'}</span>
        <strong>{ok ? 'DTE link possible now' : 'No DTE link now'}</strong>
        {reason && <span className="muted"> · {reason}</span>}
        {flip !== null && (
          <span className="muted"> · {ok ? 'link lost' : 'next link'} in {human(flip - t)}</span>
        )}
      </div>
      <ul className="stations" aria-label="Ground stations">
        {per.map(({ s, el }) => {
          const up = el > stations.meta.mask_deg
          const hears = up && terrainOk
          return (
            <li key={s.id} className={hears ? 'st-on' : 'st-off'} title={s.note}>
              <span aria-hidden="true">{hears ? '✓' : '✗'}</span> {s.name.split(' (')[0]}
              <span className="muted mono"> Moon {el.toFixed(0)}°</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
