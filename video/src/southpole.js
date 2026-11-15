// S3: south-pole flyover over NASA LOLA 120 m terrain, lit by the real low Sun (baked offline by
// pipeline/export_southpole.py: Lambert + cast shadows + penumbra, curvature included).
// Scene units: km. x = u (toward the Sun's horizontal direction), y = up, z = -v (right-handed).
//
// URL: ?labels=1|0 &mode=preview|render|still &t=<s, still> &shot=<name> &dur=12 &fps=30 &exag=1.3
import * as THREE from 'three'

const W = 1920, H = 1080
const Q = new URLSearchParams(location.search)
const num = (k, d) => (Q.has(k) ? Number(Q.get(k)) : d)
const MODE = Q.get('mode') || 'preview'
document.body.classList.add(MODE)
const LABELS = Q.get('labels') !== '0'
const SHOT = Q.get('shot') || (LABELS ? 'southpole_labels' : 'southpole_clean')
const DUR = num('dur', 12), FPS = num('fps', 30), EXAG = num('exag', 1.3)

const meta = await (await fetch('data/sp_meta.json')).json()
const hbuf = new Uint16Array(await (await fetch('data/sp_height.bin')).arrayBuffer())
const N = meta.n_mesh, HALF = meta.half_km, R = meta.moon_radius_m

const heightAt = (h_m, u, v) => (h_m * EXAG - ((u * u + v * v) * 1e6) / (2 * R)) / 1000 // km, with curvature
const P = (u, v, h_m) => new THREE.Vector3(u, heightAt(h_m, u, v), -v)

// ---------------- renderer / scene ----------------
const glCanvas = document.createElement('canvas')
glCanvas.width = W; glCanvas.height = H
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 5000)

// terrain mesh
{
  const pos = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2)
  for (let i = 0; i < N; i++) {
    const v = ((i + 0.5) / N) * 2 * HALF - HALF
    for (let j = 0; j < N; j++) {
      const u = ((j + 0.5) / N) * 2 * HALF - HALF
      const h = meta.height_lo_m + (hbuf[i * N + j] / 65535) * (meta.height_hi_m - meta.height_lo_m)
      const k = i * N + j
      pos[k * 3] = u; pos[k * 3 + 1] = heightAt(h, u, v); pos[k * 3 + 2] = -v
      uv[k * 2] = (u + HALF) / (2 * HALF); uv[k * 2 + 1] = (v + HALF) / (2 * HALF)
    }
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6)
  let p = 0
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
    const a = i * N + j, b = a + 1, c = a + N, d = c + 1
    idx.set([a, c, b, b, c, d], p); p += 6
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  const tex = new THREE.TextureLoader().load('data/sp_shade.jpg')
  tex.flipY = false // image row 0 = v = -HALF = uv.y 0
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })))
}

// stars (deterministic, faint)
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
{
  const r = rng(11), n = 7000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3)
  for (let k = 0; k < n; k++) {
    const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z)
    pos.set([4000 * s * Math.cos(a), 4000 * z, 4000 * s * Math.sin(a)], k * 3)
    const b = Math.pow(r(), 5) * 0.75 + 0.05
    col.set([b, b, b * 1.05], k * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true })))
}

// ---------------- camera path (u, v, alt km above datum) ----------------
// Slow oblique pass in from the sunlit side, then a gentle push toward Connecting Ridge.
const lab = Object.fromEntries(meta.labels.map((l) => [l.name, l]))
const cr = lab['Connecting Ridge']
const camKeys = [[150, 250, 46], [100, 175, 34], [55, 100, 24], [24, 42, 16], [9, 16, 11.5]]
const tgtKeys = [[45, 95, 0], [20, 60, 0], [0, 15, 0], [-6, -6, 1.5], [cr.u_km, cr.v_km, cr.h_m / 1000]]
const toV = ([u, v, a]) => new THREE.Vector3(u, a - ((u * u + v * v) * 1e6) / (2 * R) / 1000, -v)
const camCurve = new THREE.CatmullRomCurve3(camKeys.map(toV), false, 'centripetal')
const tgtCurve = new THREE.CatmullRomCurve3(tgtKeys.map(toV), false, 'centripetal')
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2) * 0.35 + x * 0.65 // gentle in/out

// ---------------- HUD ----------------
const out = document.getElementById('out')
const ctx = out.getContext('2d')
const MONO = '"SF Mono", Menlo, monospace'
const LABEL_TIMES = { Nobile: 0.8, 'Mons Mouton (IM-2)': 1.8, Malapert: 3.0, 'de Gerlache': 5.2, Shackleton: 6.8, 'Connecting Ridge': 8.6 }
const anchors = meta.labels.map((l) => ({ ...l, p: P(l.u_km, l.v_km, l.h_m) }))

function text(str, x, y, { size = 22, color = '#e8ecf3', align = 'left', weight = 500, spacing = 0, alpha = 1 } = {}) {
  ctx.globalAlpha = alpha
  ctx.font = `${weight} ${size}px ${MONO}`
  ctx.textAlign = align
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8
  ctx.fillText(str, x, y)
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  ctx.globalAlpha = 1
}

function drawLabels(t) {
  text('POLO SUR · LOLA', 56, 70, { size: 18, color: '#c9cfda', spacing: 4, weight: 600 })
  ctx.fillStyle = '#c9cfda'; ctx.fillRect(56, 82, 46, 1.5)
  for (const a of anchors) {
    const t0 = LABEL_TIMES[a.name]
    if (t0 === undefined || t < t0) continue
    const alpha = Math.min(1, (t - t0) / 0.6)
    const s = a.p.clone().project(camera)
    if (s.z > 1 || Math.abs(s.x) > 1.05 || Math.abs(s.y) > 1.05) continue
    const x = (s.x * 0.5 + 0.5) * W, y = (-s.y * 0.5 + 0.5) * H
    const lead = 70 * Math.min(1, (t - t0) / 0.4)
    const hl = a.name === 'Connecting Ridge'
    const size = hl ? 24 : 21, label = a.name.toUpperCase()
    ctx.font = `${hl ? 700 : 600} ${size}px ${MONO}`
    const tw = ctx.measureText(label).width + label.length * 2
    const left = x + 20 + tw > W - 48 // flip the label to the left of its leader near the right edge
    const sx = left ? -1 : 1
    ctx.globalAlpha = alpha
    ctx.strokeStyle = 'rgba(232,236,243,0.9)'; ctx.lineWidth = 1.4
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y - 5 - lead); ctx.lineTo(x + sx * 14, y - 5 - lead); ctx.stroke()
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
    ctx.globalAlpha = 1
    text(label, x + sx * 20, y - lead + 2, { size, weight: hl ? 700 : 600, spacing: 2, color: hl ? '#f4c25a' : '#e8ecf3', alpha, align: left ? 'right' : 'left' })
  }
}

// ---------------- frame ----------------
function renderAt(t) {
  const x = ease(Math.max(0, Math.min(1, t / DUR)))
  camera.position.copy(camCurve.getPoint(x))
  camera.lookAt(tgtCurve.getPoint(x))
  renderer.render(scene, camera)
  ctx.drawImage(glCanvas, 0, 0)
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.0)
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
  if (LABELS) drawLabels(t)
}
window.renderFrame = (i) => renderAt(i / FPS)

const status = document.getElementById('status')
const scrub = document.getElementById('scrub')
await new Promise((r) => (THREE.DefaultLoadingManager.onLoad = r))
await document.fonts.ready

async function post(i) {
  const blob = await new Promise((r) => out.toBlob(r, 'image/png'))
  const res = await fetch(`/frame?shot=${SHOT}&i=${i}`, { method: 'POST', body: blob })
  if (!res.ok) throw new Error(`frame ${i}: HTTP ${res.status}`)
}

if (MODE === 'render') {
  const n = Math.round(DUR * FPS)
  for (let i = 0; i < n; i++) { renderAt(i / FPS); await post(i); status.textContent = `render ${SHOT}: ${i + 1}/${n}` }
  await fetch(`/done?shot=${SHOT}&n=${n}&fps=${FPS}`, { method: 'POST' })
  status.textContent = `render ${SHOT}: done`
} else if (MODE === 'still') {
  const times = (Q.get('t') || '0,4,8,11.9').split(',').map(Number)
  for (let k = 0; k < times.length; k++) { renderAt(times[k]); await post(k) }
  status.textContent = `stills ${SHOT}: ${times.join(', ')} s`
} else {
  let t = 0, playing = true, last = performance.now()
  addEventListener('keydown', (e) => { if (e.code === 'Space') { playing = !playing; e.preventDefault() } })
  scrub.addEventListener('input', () => { t = (scrub.value / 1000) * DUR; playing = false })
  const loop = (now) => {
    if (playing) { t += (now - last) / 1000; if (t > DUR) t = 0 }
    last = now
    renderAt(t)
    scrub.value = String(Math.round((t / DUR) * 1000))
    status.textContent = `S3 · ${t.toFixed(2)} s · Sun ${meta.sun_el_at_pole_deg}° above the pole (${meta.epoch_utc}) · relief ×${EXAG}`
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
