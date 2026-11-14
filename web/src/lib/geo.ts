// Browser-side geometry: topocentric Sun/Earth az/el for ANY lunar point from the exported
// Moon-centre vectors (MOON_ME_DE421, km). Same conventions as pipeline/ephem.py:
// up = r̂, east = ẑ × up (normalised), north = up × east; azimuth clockwise from north.
// No dependencies. Verified against Skyfield by web/test/geo.test.ts.

export const MOON_R_KM = 1737.4
export const SUN_R_KM = 696340
export const EARTH_R_KM = 6371

export type Vec3 = [number, number, number]

export interface Enu {
  e: Vec3
  n: Vec3
  u: Vec3
}

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

export function unitVector(latDeg: number, lonDeg: number): Vec3 {
  const la = latDeg * D2R
  const lo = lonDeg * D2R
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}

export function enuBasis(latDeg: number, lonDeg: number): Enu {
  const u = unitVector(latDeg, lonDeg)
  // east = z × up = (-u_y, u_x, 0) normalised
  const en = Math.hypot(u[0], u[1])
  const e: Vec3 = [-u[1] / en, u[0] / en, 0]
  // north = up × east
  const n: Vec3 = [u[1] * e[2] - u[2] * e[1], u[2] * e[0] - u[0] * e[2], u[0] * e[1] - u[1] * e[0]]
  return { e, n, u }
}

export interface AzElDist {
  az: number
  el: number
  distKm: number
}

/** Topocentric az/el of a Moon-centred body vector (km) seen from a site at height hKm above the sphere. */
export function azElFrom(v: Vec3, basis: Enu, hKm: number): AzElDist {
  const r = MOON_R_KM + hKm
  const x = v[0] - r * basis.u[0]
  const y = v[1] - r * basis.u[1]
  const z = v[2] - r * basis.u[2]
  const d = Math.hypot(x, y, z)
  const pe = x * basis.e[0] + y * basis.e[1] + z * basis.e[2]
  const pn = x * basis.n[0] + y * basis.n[1] + z * basis.n[2]
  const pu = x * basis.u[0] + y * basis.u[1] + z * basis.u[2]
  let az = Math.atan2(pe, pn) * R2D
  if (az < 0) az += 360
  return { az, el: Math.asin(Math.max(-1, Math.min(1, pu / d))) * R2D, distKm: d }
}

export interface EphemVectors {
  t0: number
  stepSec: number
  n: number
  data: Float32Array // n × 6: sun xyz, earth xyz (km)
}

let vecPromise: Promise<EphemVectors> | null = null

export function loadEphemVectors(base = import.meta.env.BASE_URL): Promise<EphemVectors> {
  if (!vecPromise) {
    vecPromise = Promise.all([
      fetch(`${base}data/ephem_vectors.json`).then((r) => r.json()),
      fetch(`${base}data/ephem_vectors.bin`).then((r) => r.arrayBuffer()),
    ]).then(([meta, buf]) => ({ t0: meta.t0, stepSec: meta.stepSec, n: meta.n, data: new Float32Array(buf) }))
    vecPromise.catch(() => (vecPromise = null))
  }
  return vecPromise
}

/** Great-circle distance (km) on the 1737.4 km sphere. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = unitVector(lat1, lon1)
  const b = unitVector(lat2, lon2)
  const c = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return Math.acos(c) * MOON_R_KM
}

/** Area fraction of a disc of angular radius r above a straight horizon at offset `clear` (same as metrics.py). */
export function discFraction(clear: number, r: number): number {
  const x = Math.max(-1, Math.min(1, clear / r))
  return 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI
}
