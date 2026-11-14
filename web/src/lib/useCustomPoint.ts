import { useEffect, useState } from 'react'
import type { SiteData, SiteSummary } from './data'
import { computePoint, smoothSphereHorizon, type CustomPoint } from './custom.js'
import { distanceKm, loadEphemVectors } from './geo.js'
import { loadNeighbourhood, maskOf, nearestIndex, toPolarStereo, type Neighbourhood } from './neighbourhood.js'

/** Spec: "site-id:k" (grid point k of that site's neighbourhood) or "lat,lon" (anywhere). */
export type PointSpec = string

function gridPoint(site: SiteSummary, nb: Neighbourhood, k: number, snappedFromM?: number): CustomPoint {
  const lat = nb.lat[k], lon = nb.lon[k]
  const d = distanceKm(lat, lon, site.lat, site.lon)
  const name = d < 0.05 ? `${site.name} (grid centre)` : `Point ${d.toFixed(1)} km from ${site.name}`
  return {
    id: `pt:${site.id}:${k}`,
    name,
    lat,
    lon,
    siteHeightM: nb.heightM[k],
    horizon: maskOf(nb, k),
    horizonSource: site.horizon_source,
    note: snappedFromM !== undefined ? `snapped to the nearest 500 m grid point (${Math.round(snappedFromM)} m away)` : undefined,
  }
}

export async function resolveSpec(spec: PointSpec, sites: SiteSummary[]): Promise<CustomPoint> {
  if (spec.includes(':')) {
    const [id, kStr] = spec.split(':')
    const site = sites.find((s) => s.id === id)
    const k = Number(kStr)
    if (!site || !Number.isInteger(k)) throw new Error(`unknown point ${spec}`)
    const nb = await loadNeighbourhood(id)
    if (k < 0 || k >= nb.n * nb.n) throw new Error(`grid index out of range: ${spec}`)
    return gridPoint(site, nb, k)
  }
  const [lat, lon] = spec.split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) throw new Error(`invalid coordinates: ${spec}`)
  const lon180 = ((((lon + 180) % 360) + 360) % 360) - 180
  if (lat < -80) {
    const [x, y] = toPolarStereo(lat, lon180)
    for (const site of sites.filter((s) => s.horizon_source !== 'smooth-sphere')) {
      const [sx, sy] = toPolarStereo(site.lat, site.lon)
      if (Math.abs(x - sx) > 5300 || Math.abs(y - sy) > 5300) continue
      const nb = await loadNeighbourhood(site.id)
      const k = nearestIndex(nb, x, y)
      if (k !== null) return gridPoint(site, nb, k, distanceKm(lat, lon180, nb.lat[k], nb.lon[k]) * 1000)
    }
  }
  return {
    id: `pt:${lat.toFixed(4)},${lon180.toFixed(4)}`,
    name: `Custom point ${lat.toFixed(3)}°, ${lon180.toFixed(3)}°`,
    lat,
    lon: lon180,
    siteHeightM: 0,
    horizon: smoothSphereHorizon(),
    horizonSource: 'smooth-sphere',
    note: 'outside the precomputed terrain boxes: smooth-sphere horizon (real terrain would differ, especially near the pole)',
  }
}

export function useCustomPoint(spec: PointSpec | null, sites: SiteSummary[] | undefined) {
  const [state, setState] = useState<{ data: SiteData | null; note?: string; error?: string; busy: boolean }>({
    data: null,
    busy: false,
  })
  useEffect(() => {
    if (!spec || !sites) {
      setState({ data: null, busy: false })
      return
    }
    let alive = true
    setState((s) => ({ ...s, busy: true, error: undefined }))
    Promise.all([resolveSpec(spec, sites), loadEphemVectors()])
      .then(([p, vec]) => {
        if (alive) setState({ data: computePoint(p, vec), note: p.note, busy: false })
      })
      .catch((e) => alive && setState({ data: null, error: String(e), busy: false }))
    return () => {
      alive = false
    }
  }, [spec, sites])
  return state
}
