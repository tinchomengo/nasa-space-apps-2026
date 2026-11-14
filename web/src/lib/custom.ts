// Build a full SiteData for an arbitrary point in the browser (custom coordinates / Explore).
// Hourly resolution; events are refined by linear interpolation of the clearance (± a few minutes).
import type { HorizonSource, SiteData, SiteEvent } from './data.js'
import { EARTH_R_KM, SUN_R_KM, azElFrom, discFraction, enuBasis, type EphemVectors } from './geo.js'
import { maskAt } from './sky.js'

export const OBSERVER_H_M = 2


function crossings(g: Float64Array, t0: number, step: number, up: SiteEvent['type'], down: SiteEvent['type']): SiteEvent[] {
  const out: SiteEvent[] = []
  for (let i = 0; i + 1 < g.length; i++) {
    const a = g[i] > 0
    const b = g[i + 1] > 0
    if (a === b) continue
    const f = g[i + 1] !== g[i] ? -g[i] / (g[i + 1] - g[i]) : 0.5
    out.push({ type: b ? up : down, t: Math.round((t0 + (i + f) * step) / 60) * 60 })
  }
  return out
}

function longestRunH(flags: Uint8Array, stepSec: number): number {
  let run = 0
  let best = 0
  for (let i = 0; i < flags.length; i++) {
    run = flags[i] ? run + 1 : 0
    if (run > best) best = run
  }
  return (best * stepSec) / 3600
}

export interface CustomPoint {
  id: string
  name: string
  lat: number
  lon: number
  siteHeightM: number // terrain height above the 1737.4 km sphere (0 for smooth sphere)
  horizon: number[] // any number of uniform azimuth bins from 0° (720 or 360)
  horizonSource: HorizonSource
  note?: string
}

export function computePoint(p: CustomPoint, vec: EphemVectors): SiteData {
  const n = vec.n
  const basis = enuBasis(p.lat, p.lon)
  const hKm = (p.siteHeightM + OBSERVER_H_M) / 1000
  const sunAz = new Array<number>(n), sunEl = new Array<number>(n), sunFrac = new Array<number>(n)
  const sunClear = new Array<number>(n), earthAz = new Array<number>(n), earthEl = new Array<number>(n)
  const earthClear = new Array<number>(n)
  const gSun = new Float64Array(n), gEarth = new Float64Array(n)
  const lit = new Uint8Array(n), vis = new Uint8Array(n)
  const d = vec.data
  let nLit = 0, nAny = 0, nFull = 0, nEarth = 0, nEarthAny = 0, nEarthFull = 0, nBoth = 0
  for (let i = 0; i < n; i++) {
    const s = azElFrom([d[6 * i], d[6 * i + 1], d[6 * i + 2]], basis, hKm)
    const e = azElFrom([d[6 * i + 3], d[6 * i + 4], d[6 * i + 5]], basis, hKm)
    const rs = Math.asin(SUN_R_KM / s.distKm) * (180 / Math.PI)
    const re = Math.asin(EARTH_R_KM / e.distKm) * (180 / Math.PI)
    const cs = s.el - maskAt(p.horizon, s.az)
    const ce = e.el - maskAt(p.horizon, e.az)
    sunAz[i] = s.az; sunEl[i] = s.el; sunClear[i] = cs; sunFrac[i] = discFraction(cs, rs)
    earthAz[i] = e.az; earthEl[i] = e.el; earthClear[i] = ce
    gSun[i] = cs; gEarth[i] = ce
    lit[i] = cs > 0 ? 1 : 0
    vis[i] = ce > 0 ? 1 : 0
    nLit += lit[i]; nAny += cs > -rs ? 1 : 0; nFull += cs > rs ? 1 : 0
    nEarth += vis[i]; nEarthAny += ce > -re ? 1 : 0; nEarthFull += ce > re ? 1 : 0
    nBoth += lit[i] & vis[i]
  }
  const events = [
    ...crossings(gSun, vec.t0, vec.stepSec, 'sunrise', 'sunset'),
    ...crossings(gEarth, vec.t0, vec.stepSec, 'earthrise', 'earthset'),
  ].sort((a, b) => a.t - b.t)
  const pct = (k: number) => (100 * k) / n
  const dark = lit.map((v) => 1 - v)
  const gap = vis.map((v) => 1 - v)
  return {
    meta: {
      id: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      horizon_source: p.horizonSource,
      site_height_m: p.siteHeightM,
      observer_height_m: OBSERVER_H_M,
      span: [new Date(vec.t0 * 1000).toISOString(), new Date((vec.t0 + (n - 1) * vec.stepSec) * 1000).toISOString()],
      mean_earth_az_deg: NaN,
      initial: { sunUp: lit[0] === 1, earthUp: vis[0] === 1 },
      definitions: {
        sun: 'at least 50% of the disc above the terrain (centre clearance > 0)',
        earth: "Earth's centre above the terrain (clearance > 0)",
      },
    },
    horizon: p.horizon,
    hourly: { t0: vec.t0, stepSec: vec.stepSec, sunAz, sunEl, earthAz, earthEl, sunFrac, sunClear, earthClear },
    events,
    stats: {
      sunlit_pct: pct(nLit),
      sunlit_any_part_pct: pct(nAny),
      sunlit_full_disc_pct: pct(nFull),
      earth_visible_pct: pct(nEarth),
      earth_visible_any_limb_pct: pct(nEarthAny),
      earth_visible_full_disc_pct: pct(nEarthFull),
      both_pct: pct(nBoth),
      longest_dark_h: longestRunH(dark, vec.stepSec),
      longest_dte_gap_h: longestRunH(gap, vec.stepSec),
      computed_in_browser: true,
    },
  }
}

/** Smooth-sphere horizon (geometric dip for the observer height), 360 bins. */
export function smoothSphereHorizon(): number[] {
  const R = 1737400
  const dip = -Math.acos(R / (R + OBSERVER_H_M)) * (180 / Math.PI)
  return new Array(360).fill(dip)
}
