// S3: south-pole flyover over NASA LOLA 120 m terrain, lit by the real low Sun (baked offline by
// pipeline/export_southpole.py: Lambert + cast shadows + penumbra, curvature included).
// Scene units: km. x = u (toward the Sun's horizontal direction), y = up, z = -v (right-handed).
//
// URL: ?labels=1|0 &mode=preview|render|still &t=<s, still, clip time> &shot=<name> &dur=12 &lead=6 &fps=30 &exag=1.3
import * as THREE from 'three'
import { makeCore, HEADER, STYLE } from './sp_core.js'

const W = 1920, H = 1080
const Q = new URLSearchParams(location.search)
const num = (k, d) => (Q.has(k) ? Number(Q.get(k)) : d)
const MODE = Q.get('mode') || 'preview'
document.body.classList.add(MODE)
const LABELS = Q.get('labels') !== '0'
const SHOT = Q.get('shot') || (LABELS ? 'southpole_labels' : 'southpole_clean')
// DUR: the original 12 s flyover; LEAD: seconds of the same flight before it (camera extrapolated back
// along its starting direction and speed), so the clip is LEAD + DUR long and its last DUR s are unchanged.
const DUR = num('dur', 12), LEAD = num('lead', 6), FPS = num('fps', 30), EXAG = num('exag', 1.3)
const TOTAL = DUR + LEAD

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

// terrain meshes: detailed ±HALF box + coarser outer ring (hole where the detailed box is).
// Heights: uint16, 0 = no DEM data (triangle skipped), 1..65535 = lo..hi.
function terrainMesh(buf, n, half, lo, hi, texUrl, { hole = 0, yOff = 0 } = {}) {
  const pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2)
  for (let i = 0; i < n; i++) {
    const v = ((i + 0.5) / n) * 2 * half - half
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) / n) * 2 * half - half
      const q = buf[i * n + j], h = lo + ((Math.max(q, 1) - 1) / 65534) * (hi - lo)
      const k = i * n + j
      pos[k * 3] = u; pos[k * 3 + 1] = heightAt(h, u, v) + yOff; pos[k * 3 + 2] = -v
      uv[k * 2] = (u + half) / (2 * half); uv[k * 2 + 1] = (v + half) / (2 * half)
    }
  }
  const idx = []
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = a + 1, c = a + n, d = c + 1
    if (!buf[a] || !buf[b] || !buf[c] || !buf[d]) continue
    if (hole) {
      const u0 = pos[a * 3], u1 = pos[d * 3], v0 = -pos[a * 3 + 2], v1 = -pos[d * 3 + 2]
      if (Math.max(Math.abs(u0), Math.abs(u1)) < hole && Math.max(Math.abs(v0), Math.abs(v1)) < hole) continue
    }
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1))
  const tex = new THREE.TextureLoader().load(texUrl)
  tex.flipY = false // image row 0 = v = -half = uv.y 0
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
}
scene.add(terrainMesh(hbuf, N, HALF, meta.height_lo_m, meta.height_hi_m, 'data/sp_shade.jpg'))
{
  const o = meta.outer
  const obuf = new Uint16Array(await (await fetch('data/sp_outer_height.bin')).arrayBuffer())
  const cell = (2 * o.half_km) / o.n_mesh
  // overlap the detailed box by ~2 outer cells, slightly lower so the detailed surface wins there
  scene.add(terrainMesh(obuf, o.n_mesh, o.half_km, o.height_lo_m, o.height_hi_m, 'data/sp_outer_shade.jpg', { hole: HALF - 2 * cell, yOff: -0.06 }))
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

const core = makeCore(THREE, meta, hbuf, { exag: EXAG, W, H })

// ---------------- HUD ----------------
const out = document.getElementById('out')
const ctx = out.getContext('2d')
const MONO = '"SF Mono", Menlo, monospace'
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
  text(HEADER, 56, 70, { size: 18, color: '#c9cfda', spacing: 3, weight: 600 })
  ctx.fillStyle = '#c9cfda'; ctx.fillRect(56, 82, 46, 1.5)
  const cam = camera.clone()
  const items = core.anchors.map((a) => ({ a, alpha: core.alphaAt(a, cam, t, DUR) })).filter((o) => o.alpha > 0.01)
  core.pose(camera, t, DUR) // restore the frame's pose after the visibility checks
  for (const { a, alpha } of items) {
    const d = a.def, side = a.side
    const L = core.layout(a, camera, side)
    const lead = STYLE.lead * Math.min(1, (t - d.t0) / 0.4)
    const x = L.x, y = L.y, ty = y - lead + 2
    ctx.globalAlpha = alpha
    ctx.strokeStyle = 'rgba(232,236,243,0.9)'; ctx.lineWidth = 1.4
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y - 5 - lead); ctx.lineTo(x + side * 14, y - 5 - lead); ctx.stroke()
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
    ctx.globalAlpha = 1
    const align = side > 0 ? 'left' : 'right', tx = x + side * STYLE.gap
    text(d.title, tx, ty, { size: d.amber ? STYLE.titleHl : STYLE.title, weight: d.amber ? 700 : 600, spacing: 2, color: d.amber ? '#f4c25a' : '#e8ecf3', alpha, align })
    if (d.sub) text(d.sub, tx, ty + 6 + STYLE.sub, { size: STYLE.sub, weight: 500, spacing: 1, color: '#aab2c0', alpha: alpha * 0.9, align })
  }
}

// ---------------- frame ----------------
function renderAt(clipT) {
  const t = clipT - LEAD // flyover time: negative during the lead-in
  core.pose(camera, t, DUR)
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
  const n = Math.round(TOTAL * FPS)
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
  scrub.addEventListener('input', () => { t = (scrub.value / 1000) * TOTAL; playing = false })
  const loop = (now) => {
    if (playing) { t += (now - last) / 1000; if (t > TOTAL) t = 0 }
    last = now
    renderAt(t)
    scrub.value = String(Math.round((t / TOTAL) * 1000))
    status.textContent = `S3 · ${t.toFixed(2)} s · Sun ${meta.sun_el_at_pole_deg}° above the pole (${meta.epoch_utc}) · relief ×${EXAG}`
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
