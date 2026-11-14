import { useState } from 'react'
import type { SiteData } from '../lib/data'
import { cssVar, useCanvas } from '../lib/useCanvas'
import { DAY, utcLabel } from '../lib/format'

const LANE = 14
const GAP = 4
const LABEL_W = 64

/** Per-site window timeline: Sun lane, Earth lane, Both lane, over [t-w, t+w]; click to jump. */
export function Timeline({ sites, t, onPick, windowDays = 14 }: {
  sites: SiteData[]; t: number; onPick: (t: number) => void; windowDays?: number
}) {
  const [hoverT, setHoverT] = useState<number | null>(null)
  const t0 = t - windowDays * DAY
  const t1 = t + windowDays * DAY
  const lanesPerSite = 3
  const siteBlock = lanesPerSite * (LANE + GAP) + 18
  const height = sites.length * siteBlock + 24

  const { wrapRef, canvasRef, width } = useCanvas(height, (ctx, w, hgt) => {
    const pw = w - LABEL_W - 8
    const X = (tt: number) => LABEL_W + ((tt - t0) / (t1 - t0)) * pw
    const muted = cssVar('--muted'), grid = cssVar('--grid'), ink = cssVar('--text')
    const colors = { sun: cssVar('--sun'), earth: cssVar('--earth'), both: cssVar('--both'), off: cssVar('--neither') }
    ctx.font = '11px system-ui, sans-serif'

    // day ticks
    ctx.strokeStyle = grid
    ctx.fillStyle = muted
    ctx.textAlign = 'center'
    const firstDay = Math.ceil(t0 / DAY) * DAY
    for (let d = firstDay; d <= t1; d += DAY) {
      const x = X(d)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hgt - 18); ctx.stroke()
      const date = new Date(d * 1000)
      if (date.getUTCDate() % 7 === 1 || d === firstDay) ctx.fillText(`${date.getUTCMonth() + 1}/${date.getUTCDate()}`, x, hgt - 6)
    }

    sites.forEach((s, si) => {
      const h = s.hourly
      const y0 = si * siteBlock
      ctx.fillStyle = ink
      ctx.textAlign = 'left'
      ctx.font = 'bold 11px system-ui, sans-serif'
      ctx.fillText(s.meta.name, 4, y0 + 11)
      ctx.font = '11px system-ui, sans-serif'
      const lanes: [string, (i: number) => boolean, string][] = [
        ['☀ Sun', (i) => h.sunClear[i] > 0, colors.sun],
        ['🌍 Earth', (i) => h.earthClear[i] > 0, colors.earth],
        ['Both', (i) => h.sunClear[i] > 0 && h.earthClear[i] > 0, colors.both],
      ]
      lanes.forEach(([label, on, color], li) => {
        const y = y0 + 16 + li * (LANE + GAP)
        ctx.fillStyle = muted
        ctx.fillText(label, 4, y + LANE - 3)
        ctx.fillStyle = colors.off
        ctx.fillRect(LABEL_W, y, pw, LANE)
        ctx.fillStyle = color
        const i0 = Math.max(0, Math.floor((t0 - h.t0) / h.stepSec))
        const i1 = Math.min(h.sunEl.length - 1, Math.ceil((t1 - h.t0) / h.stepSec))
        let start: number | null = null
        for (let i = i0; i <= i1 + 1; i++) {
          const v = i <= i1 && on(i)
          if (v && start === null) start = i
          if (!v && start !== null) {
            const xa = Math.max(LABEL_W, X(h.t0 + start * h.stepSec))
            const xb = Math.min(LABEL_W + pw, X(h.t0 + i * h.stepSec))
            ctx.fillRect(xa, y, Math.max(1, xb - xa), LANE)
            start = null
          }
        }
      })
    })

    // cursor
    ctx.strokeStyle = ink
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(X(t), 0); ctx.lineTo(X(t), hgt - 18); ctx.stroke()
    ctx.lineWidth = 1
    if (hoverT !== null) {
      ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.moveTo(X(hoverT), 0); ctx.lineTo(X(hoverT), hgt - 18); ctx.stroke()
      ctx.globalAlpha = 1
    }
  })

  const toT = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left
    if (x < LABEL_W) return null
    return t0 + ((x - LABEL_W) / (rect.width - LABEL_W - 8)) * (t1 - t0)
  }

  return (
    <figure className="panel">
      <figcaption className="panel-head">
        <strong>Window timeline</strong> · ±{windowDays} days · Sun = ≥50% of disc above terrain · Earth = centre above
        terrain · <span className="muted">click to jump</span>
      </figcaption>
      <div
        ref={wrapRef}
        className="canvas-wrap clickable"
        onMouseMove={(e) => setHoverT(toT(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onMouseLeave={() => setHoverT(null)}
        onClick={(e) => {
          const v = toT(e.clientX, e.currentTarget.getBoundingClientRect())
          if (v !== null) onPick(Math.round(v / 60) * 60)
        }}
      >
        <canvas ref={canvasRef} role="img" aria-label="Sun and Earth visibility timeline" />
        {hoverT !== null && width > 0 && (
          <div className="tooltip" style={{ left: Math.min(Math.max(0, ((hoverT - t0) / (t1 - t0)) * (width - LABEL_W - 8) + LABEL_W + 12), width - 170) }}>
            {utcLabel(hoverT)}
          </div>
        )}
      </div>
      <div className="legend" aria-hidden="true">
        <span><i className="sw sun" /> Sun up</span>
        <span><i className="sw earth" /> Earth visible</span>
        <span><i className="sw both" /> Both</span>
        <span><i className="sw neither" /> Neither</span>
      </div>
    </figure>
  )
}
