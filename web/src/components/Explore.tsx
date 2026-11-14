import { useEffect, useState } from 'react'
import type { SiteSummary } from '../lib/data'
import { cssVar, useCanvas } from '../lib/useCanvas'
import { loadNeighbourhood, type Neighbourhood } from '../lib/neighbourhood'

const SIZE = 340

export interface ExplorePick {
  site: SiteSummary
  nb: Neighbourhood
  k: number // grid index
}

/** Clickable relief map of the 10 × 10 km box around a polar site (hillshade of the LOLA relief grid). */
export function Explore({ site, selected, onPick }: {
  site: SiteSummary
  selected: number | null
  onPick: (p: ExplorePick) => void
}) {
  const [nb, setNb] = useState<Neighbourhood | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hoverK, setHoverK] = useState<number | null>(null)

  useEffect(() => {
    setNb(null)
    setErr(null)
    loadNeighbourhood(site.id).then(setNb).catch((e) => setErr(String(e)))
  }, [site.id])

  const { wrapRef, canvasRef } = useCanvas(SIZE, (ctx, w) => {
    if (!nb) return
    const side = Math.min(w, SIZE)
    const r = nb.relief
    const img = ctx.createImageData(r.n, r.n)
    let lo = Infinity, hi = -Infinity
    for (const v of r.heightM) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
    // hillshade: light from the upper-left, low sun (polar feel), plus height tint
    const az = (315 * Math.PI) / 180, alt = (35 * Math.PI) / 180
    for (let i = 0; i < r.n; i++) {
      for (let j = 0; j < r.n; j++) {
        const h = (a: number, b: number) => r.heightM[Math.max(0, Math.min(r.n - 1, a)) * r.n + Math.max(0, Math.min(r.n - 1, b))]
        const dzdx = (h(i, j + 1) - h(i, j - 1)) / (2 * r.stepM)
        const dzdy = (h(i - 1, j) - h(i + 1, j)) / (2 * r.stepM)
        const slope = Math.atan(Math.hypot(dzdx, dzdy))
        const aspect = Math.atan2(dzdy, -dzdx)
        const shade = Math.max(0, Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect))
        const tint = (h(i, j) - lo) / Math.max(1, hi - lo)
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
    // grid points
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    for (let k = 0; k < nb.n * nb.n; k++) { const [x, y] = P(k); ctx.fillRect(x - 1, y - 1, 2, 2) }
    // curated site (centre)
    const c = (nb.n * nb.n - 1) / 2
    const [cx, cy] = P(c)
    ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke()
    // hover + selection
    const ring = (k: number, color: string) => {
      const [x, y] = P(k)
      ctx.strokeStyle = color; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke()
    }
    if (hoverK !== null) ring(hoverK, 'rgba(255,255,255,0.7)')
    if (selected !== null) ring(selected, cssVar('--earth'))
    // scale bar 2 km
    const px2km = (2000 / (2 * nb.halfM)) * side
    ctx.fillStyle = cssVar('--text'); ctx.fillRect(10, side - 14, px2km, 3)
    ctx.font = '11px system-ui, sans-serif'; ctx.fillText('2 km', 10, side - 20)
    ctx.textAlign = 'right'; ctx.fillText('↑ toward 0° lon (Earth side)', side - 8, 14); ctx.textAlign = 'left'
  })

  const kAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!nb) return null
    const rect = e.currentTarget.getBoundingClientRect()
    const side = Math.min(rect.width, SIZE)
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    if (x > side || y > side) return null
    const cell = side / (nb.n - 1)
    const j = Math.round(x / cell), i = Math.round(y / cell)
    return i >= 0 && i < nb.n && j >= 0 && j < nb.n ? i * nb.n + j : null
  }

  return (
    <section className="panel explore" aria-label={`Explore around ${site.name}`}>
      <div className="panel-head">
        <strong>Explore</strong> · 10 × 10 km around {site.name} · click a point (500 m grid) to recompute its countdowns,
        timeline and statistics in your browser
      </div>
      {err && <p className="error">{err}</p>}
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
          <canvas ref={canvasRef} role="img" aria-label="Shaded relief map; click to choose a point" />
        </div>
        <div className="explore-help muted">
          <p>✚ = curated site · ◯ = your point. Relief: LOLA (5 m tiles + 120 m), shown at 100 m.</p>
          <p>
            Each grid point has its own terrain horizon (1° bins, 2 m observer). Sun and Earth positions are computed
            here from the precomputed ephemeris vectors (checked against Skyfield to 0.0001°). Resolution is hourly, so
            rise/set times are good to a few minutes.
          </p>
          {hoverK !== null && nb && (
            <p className="mono">
              {nb.lat[hoverK].toFixed(4)}°, {nb.lon[hoverK].toFixed(4)}° · {nb.heightM[hoverK].toFixed(0)} m
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
