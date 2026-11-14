// Pure functions over a site's precomputed series: state at time t, countdowns, interpolation, window stats.
import type { Hourly, SiteData, SiteEvent } from './data.js'

export type Body = 'sun' | 'earth'

const RISE: Record<Body, string> = { sun: 'sunrise', earth: 'earthrise' }
const SET: Record<Body, string> = { sun: 'sunset', earth: 'earthset' }

/** Index of the last element with value <= t (or -1). */
function lastAtOrBefore(arr: SiteEvent[], t: number): number {
  let lo = 0
  let hi = arr.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].t <= t) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

export interface BodyState {
  up: boolean
  lastChange: number | null // unix s of the last rise/set at or before t
  nextSet: number | null
  nextRise: number | null
}

/** Rise/set state of a body at time t, from the event list (exact to the minute). */
export function bodyState(site: SiteData, body: Body, t: number): BodyState {
  const evs = site.events.filter((e) => e.type === RISE[body] || e.type === SET[body])
  const i = lastAtOrBefore(evs, t)
  const up = i >= 0 ? evs[i].type === RISE[body] : site.meta.initial[body === 'sun' ? 'sunUp' : 'earthUp']
  let nextSet: number | null = null
  let nextRise: number | null = null
  for (let k = i + 1; k < evs.length && (nextSet === null || nextRise === null); k++) {
    if (evs[k].type === SET[body] && nextSet === null) nextSet = evs[k].t
    if (evs[k].type === RISE[body] && nextRise === null) nextRise = evs[k].t
  }
  return { up, lastChange: i >= 0 ? evs[i].t : null, nextSet, nextRise }
}

function frac(h: Hourly, t: number): { i: number; f: number } | null {
  const x = (t - h.t0) / h.stepSec
  if (x < 0 || x > h.sunEl.length - 1) return null
  const i = Math.min(Math.floor(x), h.sunEl.length - 2)
  return { i, f: x - i }
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f
function lerpAz(a: number, b: number, f: number) {
  let d = b - a
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return (a + d * f + 360) % 360
}

export interface SkyNow {
  sunAz: number
  sunEl: number
  sunFrac: number
  sunClear: number
  earthAz: number
  earthEl: number
  earthClear: number
}

/** Linear interpolation of the hourly series at time t (null outside the span). */
export function skyAt(site: SiteData, t: number): SkyNow | null {
  const h = site.hourly
  const p = frac(h, t)
  if (!p) return null
  const { i, f } = p
  return {
    sunAz: lerpAz(h.sunAz[i], h.sunAz[i + 1], f),
    sunEl: lerp(h.sunEl[i], h.sunEl[i + 1], f),
    sunFrac: lerp(h.sunFrac[i], h.sunFrac[i + 1], f),
    sunClear: lerp(h.sunClear[i], h.sunClear[i + 1], f),
    earthAz: lerpAz(h.earthAz[i], h.earthAz[i + 1], f),
    earthEl: lerp(h.earthEl[i], h.earthEl[i + 1], f),
    earthClear: lerp(h.earthClear[i], h.earthClear[i + 1], f),
  }
}

export function spanOf(site: SiteData): [number, number] {
  const h = site.hourly
  return [h.t0, h.t0 + (h.sunEl.length - 1) * h.stepSec]
}

export interface WindowStats {
  sunlitPct: number
  earthPct: number
  bothPct: number
  longestDarkH: number
  longestDteGapH: number
}

/** Window statistics from the hourly series (Sun >= 50% disc, Earth centre), over [t0, t1]. */
export function windowStats(site: SiteData, t0: number, t1: number): WindowStats | null {
  const h = site.hourly
  const i0 = Math.max(0, Math.ceil((t0 - h.t0) / h.stepSec))
  const i1 = Math.min(h.sunEl.length - 1, Math.floor((t1 - h.t0) / h.stepSec))
  if (i1 <= i0) return null
  let sun = 0, earth = 0, both = 0, dark = 0, gap = 0, maxDark = 0, maxGap = 0
  for (let i = i0; i <= i1; i++) {
    const s = h.sunClear[i] > 0
    const e = h.earthClear[i] > 0
    if (s) sun++
    if (e) earth++
    if (s && e) both++
    dark = s ? 0 : dark + 1
    gap = e ? 0 : gap + 1
    maxDark = Math.max(maxDark, dark)
    maxGap = Math.max(maxGap, gap)
  }
  const n = i1 - i0 + 1
  const hrs = h.stepSec / 3600
  return {
    sunlitPct: (100 * sun) / n,
    earthPct: (100 * earth) / n,
    bothPct: (100 * both) / n,
    longestDarkH: maxDark * hrs,
    longestDteGapH: maxGap * hrs,
  }
}

/** Mask elevation at an azimuth (periodic linear interpolation of the 720-bin horizon). */
export function maskAt(horizon: number[], az: number): number {
  const n = horizon.length
  const x = (((az % 360) + 360) % 360) * (n / 360)
  const i = Math.floor(x) % n
  const f = x - Math.floor(x)
  return horizon[i] * (1 - f) + horizon[(i + 1) % n] * f
}
