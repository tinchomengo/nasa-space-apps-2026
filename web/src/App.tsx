import { useEffect, useMemo, useRef, useState } from 'react'
import { loadSite, loadSites, loadStations, type SiteData, type SitesIndex, type StationsData } from './lib/data'
import { DAY, fromInputUTC, toInputUTC, utcLabel } from './lib/format'
import { spanOf } from './lib/sky'
import { CountdownCard } from './components/CountdownCard'
import { Panorama } from './components/Panorama'
import { Timeline } from './components/Timeline'
import { Metrics } from './components/Metrics'
import { Explore } from './components/Explore'
import { useCustomPoint } from './lib/useCustomPoint'
import { Tabs } from './components/Tabs'
import { ValidationTab } from './components/ValidationTab'
import { MethodTab } from './components/MethodTab'
import { AboutTab } from './components/AboutTab'

const MAX_COMPARE = 3
const SPEEDS = [
  { label: 'real time', secPerSec: 1 },
  { label: '1 h/s', secPerSec: 3600 },
  { label: '6 h/s', secPerSec: 6 * 3600 },
  { label: '1 day/s', secPerSec: DAY },
]

interface UrlState {
  ids: string[]
  base: number
  slip: number
  pt: string | null
}

function readUrl(): Partial<UrlState> {
  const q = new URLSearchParams(window.location.search)
  const out: Partial<UrlState> = {}
  const site = q.get('site')
  const cmp = q.get('cmp')
  if (site) out.ids = [site, ...(cmp ? cmp.split(',') : [])].slice(0, MAX_COMPARE)
  const t = q.get('t')
  if (t) {
    const ms = Date.parse(t)
    if (Number.isFinite(ms)) out.base = Math.floor(ms / 1000)
  }
  const slip = Number(q.get('slip'))
  if (Number.isFinite(slip) && slip !== 0) out.slip = Math.max(-60, Math.min(60, Math.round(slip)))
  const pt = q.get('pt')
  if (pt) out.pt = pt
  return out
}

function writeUrl(s: UrlState) {
  const q = new URLSearchParams()
  q.set('site', s.ids[0])
  if (s.ids.length > 1) q.set('cmp', s.ids.slice(1).join(','))
  q.set('t', new Date(s.base * 1000).toISOString().slice(0, 16) + 'Z')
  if (s.slip) q.set('slip', String(s.slip))
  if (s.pt) q.set('pt', s.pt)
  window.history.replaceState(null, '', `?${q.toString()}`)
}

export default function App() {
  const init = useMemo(readUrl, [])
  const [index, setIndex] = useState<SitesIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ids, setIds] = useState<string[]>(init.ids ?? ['connecting-ridge'])
  const [base, setBase] = useState<number>(init.base ?? Math.floor(Date.now() / 1000))
  const [slip, setSlip] = useState<number>(init.slip ?? 0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [data, setData] = useState<Record<string, SiteData>>({})
  const [stations, setStations] = useState<StationsData | null>(null)
  const [pt, setPt] = useState<string | null>(init.pt ?? null)
  const [latIn, setLatIn] = useState('')
  const [lonIn, setLonIn] = useState('')
  const custom = useCustomPoint(pt, index?.sites)
  const [tab, setTab] = useState('validation')

  useEffect(() => {
    loadSites().then(setIndex).catch((e) => setError(String(e)))
    loadStations().then(setStations).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    ids.forEach((id) => {
      if (!data[id]) loadSite(id).then((d) => setData((prev) => ({ ...prev, [id]: d }))).catch((e) => setError(String(e)))
    })
  }, [ids, data])

  const t = base + slip * DAY
  useEffect(() => writeUrl({ ids, base, slip, pt }), [ids, base, slip, pt])

  // play: advance the base epoch
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (!playing) {
      last.current = null
      return
    }
    let raf = 0
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = (now - last.current) / 1000
        setBase((b) => b + dt * SPEEDS[speed].secPerSec)
      }
      last.current = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  const curated = ids.map((id) => data[id]).filter(Boolean) as SiteData[]
  const sites = custom.data ? [...curated, custom.data] : curated
  const primarySummary = index?.sites.find((s) => s.id === ids[0])
  const selectedK = pt && primarySummary && pt.startsWith(`${primarySummary.id}:`) ? Number(pt.split(':')[1]) : null
  const primary = sites[0]
  const span = primary ? spanOf(primary) : null
  const outOfSpan = span && (t < span[0] || t > span[1])

  const setSiteAt = (i: number, id: string) => setIds((prev) => prev.map((x, k) => (k === i ? id : x)))
  const tSec = Math.floor(t)

  return (
    <div className="app">
      <header className="header">
        <h1>
          T-Minus <span className="sub">Mission Clock</span>
        </h1>
        <p className="value-prop">
          Pick a south-pole site and a date. T-Minus counts down to sunset and Earthset over real NASA LOLA terrain, and
          tells you whether Malargüe can still hear you.
        </p>
      </header>

      {error && <p className="error" role="alert">Could not load data: {error}</p>}

      <section className="controls panel" aria-label="Site and time controls">
        <div className="control-group">
          <span className="control-label">Sites</span>
          {ids.map((id, i) => (
            <span key={i} className="site-pick">
              <label className="sr-only" htmlFor={`site-${i}`}>{i === 0 ? 'Primary site' : `Compare site ${i}`}</label>
              <select id={`site-${i}`} value={id} onChange={(e) => setSiteAt(i, e.target.value)}>
                {index?.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {i > 0 && (
                <button className="ghost" aria-label={`Remove ${id} from comparison`} onClick={() => setIds((p) => p.filter((_, k) => k !== i))}>
                  ✕
                </button>
              )}
            </span>
          ))}
          {ids.length < MAX_COMPARE && index && (
            <button
              className="ghost"
              onClick={() => {
                const next = index.sites.find((s) => !ids.includes(s.id))
                if (next) setIds((p) => [...p, next.id])
              }}
            >
              + Compare
            </button>
          )}
        </div>

        <div className="control-group">
          <label className="control-label" htmlFor="epoch">Planned time (UTC)</label>
          <input
            id="epoch"
            type="datetime-local"
            value={toInputUTC(base)}
            onChange={(e) => {
              const v = fromInputUTC(e.target.value)
              if (v !== null) setBase(v)
            }}
          />
          <button className="ghost" onClick={() => setBase(Math.floor(Date.now() / 1000))}>Now</button>
        </div>

        <div className="control-group slip">
          <label className="control-label" htmlFor="slip">
            Schedule slip: <strong className="mono">{slip > 0 ? '+' : ''}{slip} d</strong>
          </label>
          <input id="slip" type="range" min={-60} max={60} step={1} value={slip} onChange={(e) => setSlip(Number(e.target.value))} />
          <button className="ghost" onClick={() => setSlip(0)} disabled={slip === 0}>Reset</button>
        </div>

        <div className="control-group">
          <button onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
          <label className="sr-only" htmlFor="speed">Playback speed</label>
          <select id="speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s, i) => (
              <option key={s.label} value={i}>{s.label}</option>
            ))}
          </select>
          <span className="mono now-label">{utcLabel(tSec)}</span>
        </div>
      </section>

      <section className="panel custom-form" aria-label="Custom coordinates">
        <form
          className="control-group"
          onSubmit={(e) => {
            e.preventDefault()
            const la = Number(latIn), lo = Number(lonIn)
            if (Number.isFinite(la) && Number.isFinite(lo) && latIn !== '' && lonIn !== '') setPt(`${la},${lo}`)
          }}
        >
          <span className="control-label">Custom point</span>
          <label className="sr-only" htmlFor="lat-in">Latitude (degrees, negative = south)</label>
          <input id="lat-in" inputMode="decimal" placeholder="lat, e.g. -89.45" value={latIn} onChange={(e) => setLatIn(e.target.value)} size={12} />
          <label className="sr-only" htmlFor="lon-in">East longitude (degrees)</label>
          <input id="lon-in" inputMode="decimal" placeholder="lon °E, e.g. -137.1" value={lonIn} onChange={(e) => setLonIn(e.target.value)} size={12} />
          <button type="submit">Compute</button>
          {pt && <button type="button" className="ghost" onClick={() => setPt(null)}>Clear point</button>}
          {custom.busy && <span className="muted">computing…</span>}
          {custom.error && <span className="error">{custom.error}</span>}
          {custom.data && !custom.busy && (
            <span className="muted">
              {custom.data.meta.name} · horizon: {custom.data.meta.horizon_source === 'smooth-sphere' ? 'smooth sphere' : `LOLA ${custom.data.meta.horizon_source} (500 m grid)`}
              {custom.note ? ` · ${custom.note}` : ''} · hourly resolution
            </span>
          )}
        </form>
      </section>

      {primarySummary && primarySummary.horizon_source !== 'smooth-sphere' && (
        <Explore site={primarySummary} selected={selectedK} onPick={(p) => setPt(`${p.site.id}:${p.k}`)} />
      )}

      {outOfSpan && (
        <p className="warn" role="status">
          The selected time is outside the precomputed span ({index?.span[0].slice(0, 10)} to {index?.span[1].slice(0, 10)}).
        </p>
      )}

      <section className="cards" aria-live="polite">
        {sites.map((s) => (
          <CountdownCard key={s.meta.id} site={s} t={tSec} stations={stations} />
        ))}
        {sites.length === 0 && !error && <p className="muted">Loading…</p>}
      </section>

      {sites.map((s) => (
        <Panorama key={s.meta.id} site={s} t={tSec} />
      ))}

      {sites.length > 0 && <Timeline sites={sites} t={tSec} onPick={(v) => setBase(v - slip * DAY)} />}
      {sites.length > 0 && <Metrics sites={sites} t={tSec} />}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'validation', label: 'Validation', render: () => <ValidationTab /> },
          { id: 'method', label: 'Method', render: () => <MethodTab /> },
          { id: 'about', label: 'About', render: () => <AboutTab /> },
        ]}
      />

      <footer className="footer">
        <p>
          Data: NASA LOLA / PGDA (products 69, 78), LOLA GDR polar DEM, JPL DE421 and NAIF SPICE kernels, JPL Horizons
          (validation), ESA Malargüe station info. Everything is precomputed offline; no live API calls. Observer{' '}
          {index?.observer_height_m ?? 2} m above the terrain; no atmospheric refraction. Not an official NASA product. Built
          with AI assistance (Claude Code); see the AI disclosure in the repository.
        </p>
      </footer>
    </div>
  )
}
