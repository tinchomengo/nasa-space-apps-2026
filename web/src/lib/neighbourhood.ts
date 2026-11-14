// Neighbourhood grids (pipeline/export_browser.py): 21×21 points at 500 m around each polar site,
// each with a 360-bin horizon mask (int16 centidegrees), plus a 100 m relief grid for the map.
import { MOON_R_KM } from './geo.js'

export interface Neighbourhood {
  site: string
  n: number
  stepM: number
  halfM: number
  centre: [number, number] // polar-stereographic metres
  lat: number[]
  lon: number[]
  heightM: number[]
  relief: { stepM: number; n: number; heightM: number[] }
  masks: Int16Array // n*n × 360
}

const cache = new Map<string, Promise<Neighbourhood>>()

export function loadNeighbourhood(siteId: string, base = import.meta.env.BASE_URL): Promise<Neighbourhood> {
  if (!cache.has(siteId)) {
    const p = Promise.all([
      fetch(`${base}data/nb_${siteId}.json`).then((r) => {
        if (!r.ok) throw new Error(`nb_${siteId}.json: HTTP ${r.status}`)
        return r.json()
      }),
      fetch(`${base}data/nb_${siteId}.bin`).then((r) => r.arrayBuffer()),
    ]).then(([m, buf]) => ({
      site: m.site,
      n: m.n,
      stepM: m.step_m,
      halfM: m.half_m,
      centre: m.centre_ps_m,
      lat: m.lat,
      lon: m.lon,
      heightM: m.height_m,
      relief: { stepM: m.relief.step_m, n: m.relief.n, heightM: m.relief.height_m },
      masks: new Int16Array(buf),
    }))
    p.catch(() => cache.delete(siteId))
    cache.set(siteId, p)
  }
  return cache.get(siteId)!
}

export function maskOf(nb: Neighbourhood, k: number): number[] {
  const out = new Array<number>(360)
  for (let a = 0; a < 360; a++) out[a] = nb.masks[k * 360 + a] / 100
  return out
}

/** South polar stereographic (sphere R, true scale at the pole, lon_0 = 0): x = ρ sin λ, y = ρ cos λ. */
export function toPolarStereo(latDeg: number, lonDeg: number): [number, number] {
  const c = ((90 + latDeg) * Math.PI) / 180 // angular distance from the south pole
  const rho = 2 * MOON_R_KM * 1000 * Math.tan(c / 2)
  const lo = (lonDeg * Math.PI) / 180
  return [rho * Math.sin(lo), rho * Math.cos(lo)]
}

/** Grid index nearest to a PS point, or null if outside the box (+ half a cell). */
export function nearestIndex(nb: Neighbourhood, x: number, y: number): number | null {
  const dx = x - nb.centre[0]
  const dy = nb.centre[1] - y // row 0 is +y (top)
  const lim = nb.halfM + nb.stepM / 2
  if (Math.abs(dx) > lim || Math.abs(dy) > lim) return null
  const j = Math.round((dx + nb.halfM) / nb.stepM)
  const i = Math.round((dy + nb.halfM) / nb.stepM)
  return Math.max(0, Math.min(nb.n - 1, i)) * nb.n + Math.max(0, Math.min(nb.n - 1, j))
}
