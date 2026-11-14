// Typed loaders for the precomputed JSON in /data (see pipeline/build.py for the contract).

export interface SiteStatsSummary {
  sunlit_pct: number
  sunlit_any_part_pct: number
  sunlit_full_disc_pct: number
  earth_visible_pct: number
  both_pct: number
  link_pct: number
  longest_dark_h: number
  longest_dte_gap_h: number
}

export type HorizonSource = '5m+120m' | '120m' | 'smooth-sphere'

export interface SiteSummary {
  id: string
  name: string
  lat: number
  lon: number
  horizon_source: HorizonSource
  coord_source: string
  source: string
  why: string
  tags: string[]
  site_height_m: number
  stats: SiteStatsSummary
}

export interface SitesIndex {
  generated_utc: string
  observer_height_m: number
  span: [string, string]
  sites: SiteSummary[]
}

export type EventType = 'sunrise' | 'sunset' | 'earthrise' | 'earthset'

export interface SiteEvent {
  type: EventType
  t: number // unix seconds UTC
}

export interface Hourly {
  t0: number
  stepSec: number
  sunAz: number[]
  sunEl: number[]
  earthAz: number[]
  earthEl: number[]
  sunFrac: number[]
  sunClear: number[]
  earthClear: number[]
}

export interface SiteData {
  meta: {
    id: string
    name: string
    lat: number
    lon: number
    horizon_source: HorizonSource
    site_height_m: number
    observer_height_m: number
    span: [string, string]
    mean_earth_az_deg: number
    initial: { sunUp: boolean; earthUp: boolean }
    definitions: { sun: string; earth: string }
  }
  horizon: number[] // 720 elevations, 0.5° bins clockwise from north
  hourly: Hourly
  events: SiteEvent[]
  stats: Record<string, unknown>
}

export interface StationsData {
  meta: { mask_deg: number; t0: number; stepSec: number }
  stations: { id: string; name: string; lat: number; lon: number; note: string; moonEl: number[]; upPct: number }[]
  anyUpPct: number
}

const cache = new Map<string, Promise<unknown>>()

function getJSON<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(`${import.meta.env.BASE_URL}data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`)
      return r.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return cache.get(path) as Promise<T>
}

export const loadSites = () => getJSON<SitesIndex>('sites.json')
export const loadSite = (id: string) => getJSON<SiteData>(`site_${id}.json`)
export const loadStations = () => getJSON<StationsData>('stations.json')
