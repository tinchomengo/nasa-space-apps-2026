import { useState } from 'react'
import type { SiteData } from '../lib/data'
import { maskAt, skyAt } from '../lib/sky'
import { cssVar, useCanvas } from '../lib/useCanvas'
import { DAY } from '../lib/format'

const HEIGHT = 260
const PAD = { l: 44, r: 12, t: 16, b: 28 }

/** 360° horizon strip: terrain silhouette + Sun/Earth tracks over [t-14 d, t+14 d] + current discs. */
export function Panorama({ site, t, windowDays = 14 }: { site: SiteData; t: number; windowDays?: number }) {
  const [hover, setHover] = useState<{ x: number; az: number } | null>(null)
  const h = site.hourly
  const i0 = Math.max(0, Math.floor((t - windowDays * DAY - h.t0) / h.stepSec))
  const i1 = Math.min(h.sunEl.length - 1, Math.ceil((t + windowDays * DAY - h.t0) / h.stepSec))

  // vertical range from terrain + tracks in the window
  let lo = Math.min(...site.horizon)
  let hi = Math.max(...site.horizon)
  for (let i = i0; i <= i1; i++) {
    lo = Math.min(lo, h.sunEl[i], h.earthEl[i])
    hi = Math.max(hi, h.sunEl[i], h.earthEl[i])
  }
  lo = Math.floor(lo - 0.5)
  hi = Math.ceil(hi + 1)

  const { wrapRef, canvasRef, width } = useCanvas(HEIGHT, (ctx, w, hgt) => {
    const pw = w - PAD.l - PAD.r
    const ph = hgt - PAD.t - PAD.b
    const X = (az: number) => PAD.l + (((az % 360) + 360) % 360) / 360 * pw
    const Y = (el: number) => PAD.t + (hi - el) / (hi - lo) * ph
    const ink = cssVar('--text'), muted = cssVar('--muted'), grid = cssVar('--grid')
    const sun = cssVar('--sun'), earth = cssVar('--earth'), terrain = cssVar('--terrain')

    // grid + axes
    ctx.font = '11px system-ui, sans-serif'
    ctx.strokeStyle = grid
    ctx.fillStyle = muted
    ctx.lineWidth = 1
    for (let a = 0; a <= 360; a += 45) {
      ctx.beginPath(); ctx.moveTo(X(a === 360 ? 359.999 : a), PAD.t); ctx.lineTo(X(a === 360 ? 359.999 : a), PAD.t + ph); ctx.stroke()
      const lab = ['N', '45°', 'E', '135°', 'S', '225°', 'W', '315°', 'N'][a / 45]
      ctx.textAlign = 'center'
      ctx.fillText(lab, X(a === 360 ? 359.999 : a), hgt - 8)
    }
    const step = hi - lo > 12 ? 4 : hi - lo > 6 ? 2 : 1
    ctx.textAlign = 'right'
    for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) {
      ctx.beginPath(); ctx.moveTo(PAD.l, Y(e)); ctx.lineTo(PAD.l + pw, Y(e)); ctx.stroke()
      ctx.fillText(`${e}°`, PAD.l - 6, Y(e) + 4)
    }

    // terrain silhouette
    ctx.beginPath()
    ctx.moveTo(PAD.l, PAD.t + ph)
    for (let k = 0; k <= site.horizon.length; k++) {
      const az = k * 0.5
      ctx.lineTo(X(az === 360 ? 359.999 : az), Y(site.horizon[k % site.horizon.length]))
    }
    ctx.lineTo(PAD.l + pw, PAD.t + ph)
    ctx.closePath()
    ctx.fillStyle = terrain
    ctx.fill()
    ctx.strokeStyle = muted
    ctx.lineWidth = 1.2
    ctx.stroke()

    // tracks: faint where hidden, solid where clear
    const track = (az: number[], el: number[], clear: number[], color: string) => {
      for (const visible of [false, true]) {
        ctx.strokeStyle = color
        ctx.globalAlpha = visible ? 1 : 0.3
        ctx.lineWidth = visible ? 2 : 1
        ctx.beginPath()
        let pen = false
        for (let i = i0; i <= i1; i++) {
          const ok = visible ? clear[i] > 0 : true
          const wrap = i > i0 && Math.abs(az[i] - az[i - 1]) > 180
          if (!ok || wrap) { pen = false; if (!ok) continue }
          if (!pen) { ctx.moveTo(X(az[i]), Y(el[i])); pen = true } else ctx.lineTo(X(az[i]), Y(el[i]))
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    track(h.sunAz, h.sunEl, h.sunClear, sun)
    track(h.earthAz, h.earthEl, h.earthClear, earth)

    // current discs (radius to the vertical scale)
    const now = skyAt(site, t)
    if (now) {
      const pxPerDeg = ph / (hi - lo)
      const disc = (az: number, el: number, rDeg: number, color: string, label: string) => {
        ctx.beginPath()
        ctx.arc(X(az), Y(el), Math.max(4, rDeg * pxPerDeg), 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = cssVar('--bg')
        ctx.stroke()
        ctx.fillStyle = ink
        ctx.textAlign = 'left'
        ctx.font = 'bold 12px system-ui, sans-serif'
        ctx.fillText(label, X(az) + 8, Y(el) - 8)
        ctx.font = '11px system-ui, sans-serif'
      }
      disc(now.sunAz, now.sunEl, 0.27, sun, 'Sun')
      disc(now.earthAz, now.earthEl, 0.95, earth, 'Earth')
    }

    // hover crosshair
    if (hover) {
      ctx.strokeStyle = ink
      ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.moveTo(hover.x, PAD.t); ctx.lineTo(hover.x, PAD.t + ph); ctx.stroke()
      ctx.globalAlpha = 1
    }
  })

  const vex = width > 0 ? (360 / (width - PAD.l - PAD.r)) / ((hi - lo) / (HEIGHT - PAD.t - PAD.b)) : 0

  return (
    <figure className="panel">
      <figcaption className="panel-head">
        <strong>Horizon panorama</strong> · {site.meta.name} · tracks for ±{windowDays} days · solid = above terrain ·{' '}
        <span className="muted">elevation exaggerated ≈{vex.toFixed(0)}×</span>
      </figcaption>
      <div
        ref={wrapRef}
        className="canvas-wrap"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - r.left
          const az = ((x - PAD.l) / (r.width - PAD.l - PAD.r)) * 360
          setHover(az >= 0 && az <= 360 ? { x, az } : null)
        }}
        onMouseLeave={() => setHover(null)}
      >
        <canvas ref={canvasRef} role="img" aria-label={`Horizon panorama for ${site.meta.name}`} />
        {hover && (
          <div className="tooltip" style={{ left: Math.min(hover.x + 12, width - 170) }}>
            az {hover.az.toFixed(1)}° · terrain {maskAt(site.horizon, hover.az).toFixed(2)}°
          </div>
        )}
      </div>
      <div className="legend" aria-hidden="true">
        <span><i className="sw sun" /> Sun centre</span>
        <span><i className="sw earth" /> Earth centre</span>
        <span><i className="sw terrain" /> Terrain (LOLA, observer {site.meta.observer_height_m} m)</span>
      </div>
    </figure>
  )
}
