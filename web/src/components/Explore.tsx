import { useEffect, useState } from 'react'
import type { SiteSummary } from '../lib/data'
import { cssVar, useCanvas } from '../lib/useCanvas'
import { loadNeighbourhood, type Neighbourhood } from '../lib/neighbourhood'
import { distanceKm } from '../lib/geo'

const SIZE = 360

export interface ExplorePick {
  site: SiteSummary
  nb: Neighbourhood
  k: number
}

type Mode = 'relief' | 'sun' | 'earth' | 'both'
const MODES: { id: Mode; label: string }[] = [
  { id: 'relief', label: 'Relief' },
  { id: 'sun', label: '☀ Sunlit' },
  { id: 'earth', label: '🌍 Earth' },
  { id: 'both', label: 'Both' },
]
// Sequential, one hue per metric: dark (0%) -> bright (high). Low end matches the panel background family.
const RAMP: Record<Exclude<Mode, 'relief'>, [string, string]> = {
  sun: ['#1d2029', '#f4c25a'],
  earth: ['#1d2029', '#79b0ff'],
  both: ['#1d2029', '#4fd1bf'],
}

function hex(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
function ramp(mode: Exclude<Mode, 'relief'>, f: number): string {
  const [a, b] = RAMP[mode].map(hex)
  const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * Math.max(0, Math.min(1, f)))
  return `rgb(${m(0)},${m(1)},${m(2)})`
}

function statOf(nb: Neighbourhood, mode: Exclude<Mode, 'relief'>, k: number): number {
  return nb.stats ? nb.stats[mode][k] : NaN
}

/** Clickable relief / heatmap of the 10 × 10 km box around a polar site, with the picked point's metrics. */
export function Explore({ site, selected, onPick, onShowCards }: {
  site: SiteSummary
  selected: number | null
  onPick: (p: ExplorePick) => void
  onShowCards: () => void
}) {
  const [nb, setNb] = useState<Neighbourhood | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hoverK, setHoverK] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('sun')

  useEffect(() => {
    setNb(null)
    setErr(null)
    loadNeighbourhood(site.id).then(setNb).catch((e) => setErr(String(e)))
  }, [site.id])

  const maxOf = (m: Exclude<Mode, 'relief'>) => (nb?.stats ? Math.max(1, ...nb.stats[m]) : 100)

  const { wrapRef, canvasRef } = useCanvas(SIZE, (ctx, w) => {
    if (!nb) return
    const side = Math.min(w, SIZE)
    const r = nb.relief
    const img = ctx.createImageData(r.n, r.n)
    let lo = Infinity, hi = -Infinity
    for (const v of r.heightM) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
    const az = (315 * Math.PI) / 180, alt = (35 * Math.PI) / 180
    const H = (a: number, b: number) => r.heightM[Math.max(0, Math.min(r.n - 1, a)) * r.n + Math.max(0, Math.min(r.n - 1, b))]
    for (let i = 0; i < r.n; i++) {
      for (let j = 0; j < r.n; j++) {
        const dzdx = (H(i, j + 1) - H(i, j - 1)) / (2 * r.stepM)
        const dzdy = (H(i - 1, j) - H(i + 1, j)) / (2 * r.stepM)
        const slope = Math.atan(Math.hypot(dzdx, dzdy))
        const aspect = Math.atan2(dzdy, -dzdx)
        const shade = Math.max(0, Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect))
        const tint = (H(i, j) - lo) / Math.max(1, hi - lo)
        const v = Math.round(40 + 150 * shade + 50 * tint)
        const p = 4 * (i * r.n + j)
        img.data[p] = v; img.data[p + 1] = v; img.data[p + 2] = Math.min(255, v + 8); img.data[p + 3] = 255
      }
    }
    const off = document.createElement('canvas')
    off.width = r.n; off.height = r.n
    off.getContext('2d')!.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off, 0, 0, side, side)

    const cell = side / (nb.n - 1)
    const P = (k: number) => [(k % nb.n) * cell, Math.floor(k / nb.n) * cell] as const

    if (mode !== 'relief' && nb.stats) {
      const mx = maxOf(mode)
      ctx.globalAlpha = 0.78
      for (let k = 0; k < nb.n * nb.n; k++) {
        const [x, y] = P(k)
        ctx.fillStyle = ramp(mode, statOf(nb, mode, k) / mx)
        ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell)
      }
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      for (let k = 0; k < nb.n * nb.n; k++) { const [x, y] = P(k); ctx.fillRect(x - 1, y - 1, 2, 2) }
    }

    const c = (nb.n * nb.n - 1) / 2
    const [cx, cy] = P(c)
    ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke()
    const ring = (k: number, color: string, wdt: number) => {
      const [x, y] = P(k)
      ctx.strokeStyle = color; ctx.lineWidth = wdt
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke()
    }
    if (hoverK !== null) ring(hoverK, 'rgba(255,255,255,0.8)', 2)
    if (selected !== null) { ring(selected, cssVar('--bg'), 5); ring(selected, '#ffffff', 2.5) }
    const px2km = (2000 / (2 * nb.halfM)) * side
    ctx.fillStyle = cssVar('--text'); ctx.fillRect(10, side - 14, px2km, 3)
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('2 km', 10, side - 20)
    ctx.textAlign = 'right'; ctx.fillText('↑ toward 0° lon (Earth side)', side - 8, 14); ctx.textAlign = 'left'
  })

  const kAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!nb) return null
    const rect = e.currentTarget.getBoundingClientRect()
    const side = Math.min(rect.width, SIZE)
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    if (x > side + 4 || y > side + 4) return null
    const cell = side / (nb.n - 1)
    const j = Math.round(x / cell), i = Math.round(y / cell)
    return i >= 0 && i < nb.n && j >= 0 && j < nb.n ? i * nb.n + j : null
  }

  const centreK = nb ? (nb.n * nb.n - 1) / 2 : 0
  const sel = selected !== null && nb ? selected : null

  return (
    <section className="panel explore" aria-label={`Explore around ${site.name}`}>
      <div className="panel-head">
        <strong>Explore</strong> · 10 × 10 km around {site.name} · 441 points, 500 m apart · click one to add it to the
        countdowns, timeline and metrics
      </div>
      {err && <p className="error">{err}</p>}
      <div className="seg" role="radiogroup" aria-label="Map layer">
        {MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'seg-btn on' : 'seg-btn'} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
        {mode !== 'relief' && nb?.stats && (
          <span className="ramp-legend" aria-hidden="true">
            0%
            <i style={{ background: `linear-gradient(90deg, ${RAMP[mode][0]}, ${RAMP[mode][1]})` }} />
            {maxOf(mode).toFixed(0)}% <span className="muted">(full span 2026–2028)</span>
          </span>
        )}
      </div>
      <div className="explore-body">
        <div
          ref={wrapRef}
          className="canvas-wrap clickable explore-map"
          style={{ maxWidth: SIZE }}
          onMouseMove={(e) => setHoverK(kAt(e))}
          onMouseLeave={() => setHoverK(null)}
          onClick={(e) => {
            const k = kAt(e)
            if (k !== null && nb) onPick({ site, nb, k })
          }}
        >
          <canvas ref={canvasRef} role="img" aria-label="Shaded relief and visibility heatmap; click to choose a point" />
          {hoverK !== null && nb && (
            <div className="tooltip" style={{ left: 8, top: 22 }}>
              {nb.heightM[hoverK].toFixed(0)} m
              {nb.stats ? ` · ☀ ${nb.stats.sun[hoverK].toFixed(1)}% · 🌍 ${nb.stats.earth[hoverK].toFixed(1)}%` : ''}
            </div>
          )}
        </div>

        <div className="explore-side">
          {sel === null || !nb ? (
            <div className="muted">
              <p>✚ = {site.name} · click any point to evaluate it.</p>
              <p>
                Each point has its own terrain skyline (1° bins, 2 m mast). Sun and Earth positions are computed in your
                browser from the precomputed ephemeris (checked against Skyfield to 0.0001°), hourly, so rise/set times are
                good to a few minutes.
              </p>
            </div>
          ) : (
            <PointPanel nb={nb} k={sel} centreK={centreK} site={site} onShowCards={onShowCards} />
          )}
        </div>
      </div>
    </section>
  )
}

function PointPanel({ nb, k, centreK, site, onShowCards }: {
  nb: Neighbourhood; k: number; centreK: number; site: SiteSummary; onShowCards: () => void
}) {
  const d = distanceKm(nb.lat[k], nb.lon[k], nb.lat[centreK], nb.lon[centreK])
  const dh = nb.heightM[k] - nb.heightM[centreK]
  const rows: [string, Exclude<Mode, 'relief'>][] = [['☀ Sunlit (≥50% disc)', 'sun'], ['🌍 Earth visible (centre)', 'earth'], ['Both', 'both']]
  return (
    <div className="point-panel">
      <h4>📍 Your point</h4>
      <p className="mono small">
        {nb.lat[k].toFixed(4)}°, {nb.lon[k].toFixed(4)}° · {nb.heightM[k].toFixed(0)} m
      </p>
      <p>
        <strong>{d < 0.05 ? 'At' : `${d.toFixed(2)} km from`}</strong> {site.name}
        {d >= 0.05 && <span className="muted"> · {dh >= 0 ? '+' : '−'}{Math.abs(dh).toFixed(0)} m height</span>}
      </p>
      {nb.stats && (
        <table className="metrics compact">
          <thead>
            <tr>
              <th scope="col">Full span</th>
              <th scope="col">Point</th>
              <th scope="col">Site</th>
              <th scope="col">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, m]) => {
              const a = nb.stats![m][k], b = nb.stats![m][centreK]
              return (
                <tr key={m}>
                  <th scope="row">{label}</th>
                  <td>{a.toFixed(1)}%</td>
                  <td className="muted">{b.toFixed(1)}%</td>
                  <td className={a - b > 0.05 ? 'delta-up' : a - b < -0.05 ? 'delta-down' : ''}>
                    {a - b >= 0 ? '+' : '−'}{Math.abs(a - b).toFixed(1)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="small muted">"Site" = the curated point, computed the same way (hourly, 1° skyline).</p>
      <button onClick={onShowCards}>Show its countdowns ↑</button>
    </div>
  )
}
