// Minimal Spanish HUD on pure black (#000) for Screen blending in the editor. Same visual language as
// the S3 flyover labels: spaced monospace, white, soft shadow. No terrain, Earth, stars or data panels.
//
// Render shots (scripted, 6 s each):
//   ?shot=hud_es_earthset  : "LA TIERRA SE PONE EN" T-00:00:05 -> 00:00:00 -> "SEÑAL PERDIDA" (red, steady) 1.5 s
//   ?shot=hud_es_earthrise : "LA TIERRA SALE EN"   T-00:00:03 -> 00:00:00 -> "ENLACE ✓ MALARGÜE" (green) 2 s
//   &mode=render | still (&t=a,b,...) | preview
// Live (laptop in Act 4), synced with video/hw_antenna.py:
//   ?mode=live&start=<epoch ms>&knots=w:t;w:t;...   (hw_antenna.py prints this URL; --open opens it)
//   Uses the same data (s1_mar2027.json), the same time map and the same test as the mount
//   (Earth clearance <= 0), so "SEÑAL PERDIDA" appears when the antenna parks/stows.
const W = 1920, H = 1080
const Q = new URLSearchParams(location.search)
const MODE = Q.get('mode') || 'preview'
document.body.classList.add(MODE)
const SHOT = Q.get('shot') || 'hud_es_earthset'
const FPS = Number(Q.get('fps') || 30)

const C = { text: '#e8ecf3', dim: '#aab2c0', amber: '#f4c25a', red: '#ff4d4d', green: '#4fd1a5' }
const MONO = '"SF Mono", Menlo, monospace'
const out = document.getElementById('out')
const ctx = out.getContext('2d')
const pad2 = (n) => String(n).padStart(2, '0')
const hms = (s) => `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`

function text(str, x, y, { size = 22, color = C.text, align = 'left', weight = 600, spacing = 2, alpha = 1 } = {}) {
  ctx.globalAlpha = alpha
  ctx.font = `${weight} ${size}px ${MONO}`
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8
  // letterSpacing adds trailing space after the last glyph; nudge centred text back by half of it
  ctx.fillText(str, align === 'center' ? x + spacing / 2 : x, y)
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  ctx.globalAlpha = 1
}

function frame() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  text('CRESTA DE CONEXIÓN · POLO SUR', 56, 70, { size: 18, color: '#c9cfda', spacing: 3 })
  ctx.fillStyle = '#c9cfda'; ctx.fillRect(56, 82, 46, 1.5)
  const tag = 'TIEMPO ACELERADO'
  ctx.font = `600 15px ${MONO}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'
  const tw = ctx.measureText(tag).width + 24
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5
  ctx.strokeRect(W - 56 - tw, 50, tw, 30)
  text(tag, W - 56 - tw / 2, 71, { size: 15, color: C.amber, align: 'center', spacing: 2 })
}

function countdown(lead, digits) {
  text(lead, W / 2, 470, { size: 28, color: C.dim, align: 'center', spacing: 8, weight: 600 })
  text(`T-${hms(digits)}`, W / 2, 610, { size: 128, align: 'center', spacing: 6, weight: 700 })
}
function banner(str, color, size = 112) {
  text(str, W / 2, 590, { size, color, align: 'center', spacing: 8, weight: 800 })
}

// ---------------- scripted shots ----------------
// countdown phase: `from` .. 1 in equal steps, then 00:00:00 for ZERO s, then the hard switch at tSwitch
const SHOTS = {
  hud_es_earthset: { lead: 'LA TIERRA SE PONE EN', from: 5, tSwitch: 4.5, dur: 6, end: ['SEÑAL PERDIDA', C.red, 112] },
  hud_es_earthrise: { lead: 'LA TIERRA SALE EN', from: 3, tSwitch: 4.0, dur: 6, end: ['ENLACE ✓ MALARGÜE', C.green, 96] },
}
const ZERO = 0.5

function scripted(t) {
  const s = SHOTS[SHOT]
  frame()
  if (t < s.tSwitch) {
    const step = (s.tSwitch - ZERO) / s.from
    const d = t >= s.tSwitch - ZERO ? 0 : s.from - Math.floor(t / step)
    countdown(s.lead, d)
  } else banner(...s.end)
}

// ---------------- live (synced with hw_antenna.py) ----------------
async function live() {
  const doc = await (await fetch('data/s1_mar2027.json')).json()
  const M = doc.meta, S = doc.s
  const knots = Q.get('knots').split(';').map((p) => p.split(':').map(Number))
  const start = Number(Q.get('start'))
  const pw = (pts, x) => {
    if (x <= pts[0][0]) return pts[0][1]
    for (let k = 1; k < pts.length; k++) if (x <= pts[k][0]) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) }
    return pts[pts.length - 1][1]
  }
  const inv = knots.map(([a, b]) => [b, a])
  const at = (arr, t) => { const x = Math.max(0, Math.min(M.n - 1.0001, (t - M.t0) / M.stepSec)), i = Math.floor(x), f = x - i; return arr[i] + (arr[i + 1] - arr[i]) * f }
  const ev = (type, iso) => { const g = Date.parse(iso + ':00Z') / 1000; return doc.events.filter((e) => e.type === type).reduce((a, b) => (Math.abs(b.t - g) < Math.abs(a.t - g) ? b : a)).t }
  const T_SET = ev('earthset', M.chosen.earthset), T_RISE = ev('earthrise', M.chosen.earthrise)
  const NAMES = { malargue: 'MALARGÜE', goldstone: 'GOLDSTONE', madrid: 'MADRID', canberra: 'CANBERRA' }
  const loop = () => {
    const w = (Date.now() - start) / 1000
    const t = pw(knots, Math.max(0, w))
    const up = at(S.earthClear, t) > 0 // the same test hw_antenna.py uses to park / stow
    frame()
    if (t < T_SET && up) countdown('LA TIERRA SE PONE EN', Math.max(0, Math.ceil(pw(inv, T_SET) - w)))
    else if (!up) {
      const remain = pw(inv, T_RISE) - w
      if (remain > 3.0) banner('SEÑAL PERDIDA', C.red, 112) // steady while hidden; countdown for the last 3 s
      else countdown('LA TIERRA SALE EN', Math.max(0, Math.ceil(remain)))
    } else {
      const linked = M.stations.filter((s) => at(S.stationEl[s.id], t) > M.station_mask_deg).map((s) => s.id)
      const via = linked.includes('malargue') ? 'malargue' : linked[0]
      banner(via ? `ENLACE ✓ ${NAMES[via]}` : 'TIERRA A LA VISTA', via ? C.green : C.text, 96)
    }
    requestAnimationFrame(loop)
  }
  loop()
}

// ---------------- modes ----------------
const status = document.getElementById('status')
await document.fonts.ready
async function post(i, shot) {
  const blob = await new Promise((r) => out.toBlob(r, 'image/png'))
  const res = await fetch(`/frame?shot=${shot}&i=${i}`, { method: 'POST', body: blob })
  if (!res.ok) throw new Error(`frame ${i}: HTTP ${res.status}`)
}
if (MODE === 'live') {
  live()
} else if (MODE === 'render') {
  const n = Math.round(SHOTS[SHOT].dur * FPS)
  for (let i = 0; i < n; i++) { scripted(i / FPS); await post(i, SHOT); status.textContent = `render ${SHOT}: ${i + 1}/${n}` }
  await fetch(`/done?shot=${SHOT}&n=${n}&fps=${FPS}`, { method: 'POST' })
  status.textContent = `render ${SHOT}: done`
} else if (MODE === 'still') {
  const times = (Q.get('t') || '1,5').split(',').map(Number)
  for (let k = 0; k < times.length; k++) { scripted(times[k]); await post(k, Q.get('out') || 'hud-preview') }
  status.textContent = `stills ${SHOT}: ${times.join(', ')} s`
} else {
  const t0 = performance.now()
  const loop = () => { const t = ((performance.now() - t0) / 1000) % SHOTS[SHOT].dur; scripted(t); status.textContent = `${SHOT} · ${t.toFixed(2)} s`; requestAnimationFrame(loop) }
  loop()
}
