// S1: ridge POV from Shackleton Connecting Ridge at a real Earthset / Earthrise.
// True scale everywhere: terrain ridgelines from our horizon computation (distance bands),
// Earth at its real position, size, phase and rotation (DE421 + MOON_ME + ITRS), no exaggeration.
// Only the countdown digits are dramatized: they count VIDEO seconds (sim time / time-lapse factor),
// and the HUD says TIME-LAPSE. UTC, elevations and link states are real.
//
// URL: ?shot=earthset|earthrise|alt-earthset|cycle &mode=preview|render|live
//      &lapse=<sim s per video s> &pre=<video s before event> &dur=<video s> &fps=30
//      live: &start=<epoch ms when playback starts> &knots=w:t;w:t;... (video s : unix s, from hw_antenna.py)
//      framing overrides: &caz= &cel= &fov=
import * as THREE from 'three'

const W = 1920, H = 1080
const Q = new URLSearchParams(location.search)
const num = (k, d) => (Q.has(k) ? Number(Q.get(k)) : d)
const MODE = Q.get('mode') || 'preview'
document.body.classList.add(MODE)

const SHOTS = {
  earthset: { data: 'mar2027', key: 'earthset', type: 'earthset', pre: 7, dur: 10, lapse: 10800 },
  earthrise: { data: 'mar2027a', key: 'earthrise_shot', type: 'earthrise', pre: 3, dur: 8, lapse: 5400 },
  'alt-earthset': { data: 'aug2027', key: 'alt_earthset', type: 'earthset', pre: 7, dur: 10, lapse: 10800 },
  cycle: { data: 'mar2027', key: 'earthset', type: 'cycle', pre: 4, dur: 24, lapse: 0 },
}
const SHOT_ID = Q.get('shot') || 'earthset'
const SHOT = SHOTS[SHOT_ID]
const FPS = num('fps', 30)
const D2R = Math.PI / 180
const R_MOON_M = 1737400

// ---------------- data ----------------
const doc = await (await fetch(`data/s1_${SHOT.data}.json`)).json()
const M = doc.meta, S = doc.s
const findEvent = (type, iso) => {
  const target = Date.parse(iso + ':00Z') / 1000
  return doc.events.filter((e) => e.type === type).reduce((a, b) => (Math.abs(b.t - target) < Math.abs(a.t - target) ? b : a)).t
}
const T_SET = SHOT.type === 'earthrise' ? null : findEvent('earthset', M.chosen[SHOT.key])
const T_RISE = SHOT.type === 'earthrise' ? findEvent('earthrise', M.chosen[SHOT.key]) : SHOT.type === 'cycle' ? findEvent('earthrise', M.chosen.earthrise) : null
const T_EVENT = SHOT.type === 'earthrise' ? T_RISE : T_SET

const DUR = num('dur', SHOT.dur)
// cycle: 2 d before Earthset -> 2 d after Earthrise in DUR s, piecewise (same as video/hw_common.py):
// thirds for [set-2d, set+3h], [set+3h, rise-3h] (hidden, fast-forwarded), [rise-3h, rise+2d].
// live/cycle URLs may pass knots=w:t;w:t;... (video seconds : unix seconds) from hw_antenna.py.
const KNOTS = Q.has('knots')
  ? Q.get('knots').split(';').map((p) => p.split(':').map(Number))
  : SHOT.type === 'cycle'
    ? [[0, T_SET - 2 * 86400], [DUR / 3, T_SET + 3 * 3600], [(2 * DUR) / 3, T_RISE - 3 * 3600], [DUR, T_RISE + 2 * 86400]]
    : null
const LAPSE = KNOTS ? (KNOTS[1][1] - KNOTS[0][1]) / (KNOTS[1][0] - KNOTS[0][0]) : num('lapse', SHOT.lapse)
const PRE = num('pre', SHOT.pre)
function pw(pts, x) {
  if (x <= pts[0][0]) return pts[0][1]
  for (let k = 1; k < pts.length; k++) if (x <= pts[k][0]) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) }
  return pts[pts.length - 1][1]
}
// video-second coordinate of a sim time (countdown digits = video seconds to the event)
const vsec = (t) => (KNOTS ? pw(KNOTS.map(([a, b]) => [b, a]), t) : (t - T_EVENT) / LAPSE + PRE)

function sample(t) {
  const x = Math.max(0, Math.min(M.n - 1.0001, (t - M.t0) / M.stepSec))
  const i = Math.floor(x), f = x - i
  const L = (a) => a[i] + (a[i + 1] - a[i]) * f
  const LA = (a) => { let d = a[i + 1] - a[i]; if (d > 180) d -= 360; if (d < -180) d += 360; return (a[i] + d * f + 360) % 360 }
  const ax = []
  for (let k = 0; k < 9; k++) ax.push(S.earthAxes[i * 9 + k] + (S.earthAxes[(i + 1) * 9 + k] - S.earthAxes[i * 9 + k]) * f)
  const st = {}
  for (const s of M.stations) st[s.id] = L(S.stationEl[s.id])
  return {
    sunAz: LA(S.sunAz), sunEl: L(S.sunEl), earthAz: LA(S.earthAz), earthEl: L(S.earthEl),
    earthDist: L(S.earthDistKm), earthClear: L(S.earthClear), sunClear: L(S.sunClear), axes: ax, st,
  }
}

// ENU (az clockwise from north, el) -> three.js (x = east, y = up, z = -north)
const dir = (az, el) => new THREE.Vector3(Math.cos(el * D2R) * Math.sin(az * D2R), Math.sin(el * D2R), -Math.cos(el * D2R) * Math.cos(az * D2R))
const enu2three = (e, n, u) => new THREE.Vector3(e, u, -n)

// ---------------- scene ----------------
const glCanvas = document.createElement('canvas')
glCanvas.width = W; glCanvas.height = H
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

const ev0 = sample(T_EVENT)
const camAz = num('caz', ev0.earthAz)
const camEl = num('cel', ev0.earthEl + 0.6)
const camera = new THREE.PerspectiveCamera(num('fov', 7.5), W / H, 1, 30000)
camera.position.set(0, 0, 0)
camera.up.set(0, 1, 0)
camera.lookAt(dir(camAz, camEl))

// stars (deterministic)
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
{
  const r = rng(42), N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3)
  for (let k = 0; k < N; k++) {
    const az = camAz + (r() - 0.5) * 40, el = camEl + (r() - 0.5) * 24
    const v = dir(az, el).multiplyScalar(20000)
    pos.set([v.x, v.y, v.z], k * 3)
    const b = Math.pow(r(), 4) * 0.9 + 0.08, warm = r() * 0.15
    col.set([b, b * (1 - warm * 0.3), b * (1 - warm)], k * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true })))
}

// Sun glow sprite (only visible if in frame and above the terrain)
const sunTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.08, 'rgba(255,240,210,0.9)'); gr.addColorStop(0.3, 'rgba(255,200,140,0.18)'); gr.addColorStop(1, 'rgba(255,180,120,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
})()
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false }))
const SUN_R = 15000
sun.scale.setScalar(SUN_R * Math.tan(6 * D2R))
scene.add(sun)

// Earth: true angular size at R_EARTH_SCENE; orientation from ITRS axes; lit by the real Sun direction
const loader = new THREE.TextureLoader()
const day = loader.load('textures/earth_daymap_5400.jpg'); day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8
const spec = loader.load('textures/earth_specular_2048.jpg')
const clouds = loader.load('textures/earth_clouds_2048.png'); clouds.colorSpace = THREE.SRGBColorSpace
const EARTH_D = 10000
const earth = new THREE.Group()
const earthBody = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshPhongMaterial({ map: day, specularMap: spec, specular: new THREE.Color(0x333333), shininess: 18 }))
const earthClouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 128, 64), new THREE.MeshLambertMaterial({ map: clouds, transparent: true, opacity: 0.85, depthWrite: false }))
const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 48), new THREE.ShaderMaterial({
  uniforms: { sunDir: { value: new THREE.Vector3() } },
  vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: 'uniform vec3 sunDir; varying vec3 vN; varying vec3 vW; void main(){ vec3 v = normalize(cameraPosition - vW); float rim = pow(1.0 - max(dot(vN, v), 0.0), 3.0); float lit = smoothstep(-0.25, 0.35, dot(vN, sunDir)); gl_FragColor = vec4(vec3(0.35,0.6,1.0)*rim*lit*1.4, rim*lit); }',
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
}))
const spin = new THREE.Group()
spin.add(earthBody, earthClouds)
earth.add(spin, atmo)
scene.add(earth)
const sunLight = new THREE.DirectionalLight(0xffffff, 2.6)
sunLight.target = earth
scene.add(sunLight, sunLight.target)
scene.add(new THREE.AmbientLight(0x223344, 0.04))

// Terrain: one ridgeline per distance band (far -> near), filled down to -25°.
const azStep = doc.horizon.az_step_deg
const NAZ = doc.horizon.full.length
const bands = doc.horizon.layers.map((L, b) => {
  const rad = 1500 + b * 900 // nearer bands closer to the camera (depth order); all well inside Earth's distance
  const pos = new Float32Array((NAZ + 1) * 2 * 3)
  const col = new Float32Array((NAZ + 1) * 2 * 3)
  const idx = []
  for (let k = 0; k <= NAZ; k++) {
    const i = k % NAZ, az = k * azStep
    const top = dir(az, L.el[i]).multiplyScalar(rad), bot = dir(az, -25).multiplyScalar(rad)
    pos.set([top.x, top.y, top.z], (2 * k) * 3); pos.set([bot.x, bot.y, bot.z], (2 * k + 1) * 3)
    if (k < NAZ) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
  mesh.renderOrder = -b
  scene.add(mesh)
  return { L, mesh, col, near: b === 0 }
}).reverse()

// Shading: the face we see points back at us (az + 180°). Its local Sun elevation includes the
// curvature tilt over the ridge's distance. Lit if the local Sun is up; brightness from the face angle.
function shadeTerrain(s, earthLit) {
  for (const { L, mesh, col, near } of bands) {
    for (let k = 0; k <= NAZ; k++) {
      const i = k % NAZ, az = k * azStep
      const dist = L.dist_m[i] || 500
      const dAz = (s.sunAz - az) * D2R
      const localSun = s.sunEl + (dist / R_MOON_M) / D2R * Math.cos(dAz)
      const slope = 18 * D2R, e = Math.max(localSun, 0) * D2R
      let lit = localSun > 0 ? Math.max(0, Math.sin(slope) * -Math.cos(dAz) * Math.cos(e) + Math.cos(slope) * Math.sin(e)) : 0
      lit = Math.min(1, lit * 9)
      const rim = localSun > 0 && Math.cos(dAz) > 0 ? Math.min(1, 0.6 * Math.cos(dAz)) : 0 // crest catching back-light
      const amb = 0.012 + 0.03 * earthLit
      const base = near ? 0.75 : 0.95
      const top = [amb + base * lit * 0.62 + rim * 0.5, amb + base * lit * 0.6 + rim * 0.45, amb + base * lit * 0.58 + rim * 0.38]
      const bot = top.map((c) => c * (near ? 0.35 : 0.55))
      col.set(top, 2 * k * 3); col.set(bot, (2 * k + 1) * 3)
    }
    mesh.geometry.attributes.color.needsUpdate = true
  }
}

function earthLitFraction(s) {
  const a = dir(s.sunAz, s.sunEl), b = dir(s.earthAz, s.earthEl)
  return (1 - a.dot(b)) / 2
}

function placeBodies(s) {
  const de = dir(s.earthAz, s.earthEl)
  const rScene = EARTH_D * Math.sin(Math.asin(M.earth_radius_km / s.earthDist)) // true angular radius
  earth.position.copy(de.clone().multiplyScalar(EARTH_D))
  earth.scale.setScalar(rScene)
  const a = s.axes
  const X = enu2three(a[0], a[1], a[2]), Y = enu2three(a[3], a[4], a[5]), Z = enu2three(a[6], a[7], a[8])
  X.normalize(); Z.sub(X.clone().multiplyScalar(Z.dot(X))).normalize(); Y.crossVectors(Z, X) // re-orthonormalize
  spin.setRotationFromMatrix(new THREE.Matrix4().makeBasis(X, Z, Y.clone().negate()))
  const ds = dir(s.sunAz, s.sunEl)
  sunLight.position.copy(earth.position).add(ds.clone().multiplyScalar(1000))
  atmo.material.uniforms.sunDir.value.copy(ds)
  sun.position.copy(ds.multiplyScalar(SUN_R))
  sun.visible = s.sunClear > -0.3
}

// ---------------- HUD (drawn on the output canvas, so it is captured) ----------------
const out = document.getElementById('out')
const ctx = out.getContext('2d')
const MONO = '"SF Mono", Menlo, monospace'
const C = { text: '#e8ecf3', dim: '#8b93a3', amber: '#f4c25a', red: '#ff4d4d', green: '#4fd1a5', blue: '#79b0ff' }
const pad2 = (n) => String(n).padStart(2, '0')
const utc = (t) => { const d = new Date(t * 1000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}` }
const hms = (sec) => { const s = Math.max(0, Math.ceil(sec - 1e-6)); return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}` }
const latlon = `${Math.abs(M.lat).toFixed(2)}°S  ${Math.abs(M.lon).toFixed(2)}°W`
const STN = { malargue: 'MALARGÜE DSA-3', goldstone: 'GOLDSTONE DSS-14', madrid: 'MADRID DSS-63', canberra: 'CANBERRA DSS-43' }

function text(str, x, y, { size = 22, color = C.text, align = 'left', weight = 500, spacing = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${MONO}`
  ctx.textAlign = align
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
  ctx.fillStyle = color
  ctx.fillText(str, x, y)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}

function drawHud(s, tSim, vt) {
  const up = s.earthClear > 0
  const links = M.stations.filter((st) => s.st[st.id] > M.station_mask_deg)
  const link = up && links.length > 0
  // top-left: site
  text('T-MINUS · MISSION CLOCK', 56, 70, { size: 18, color: C.dim, spacing: 3 })
  text(M.name.toUpperCase(), 56, 104, { size: 26, weight: 600, spacing: 1 })
  text(`${latlon} · ${M.observer_height_m.toFixed(0)} m MAST`, 56, 134, { size: 18, color: C.dim })
  // top-right: real UTC + TIME-LAPSE tag
  text(`UTC ${utc(tSim)}`, W - 56, 104, { size: 26, align: 'right', weight: 600 })
  ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5
  ctx.font = `600 15px ${MONO}`
  const tw = ctx.measureText('TIME-LAPSE').width + 22
  ctx.strokeRect(W - 56 - tw, 118, tw, 26)
  text('TIME-LAPSE', W - 56 - 11, 137, { size: 15, color: C.amber, align: 'right', weight: 600 })

  // centre-top: countdown (video seconds to the event) / state
  const target = SHOT.type === 'earthrise' ? T_RISE : (SHOT.type === 'cycle' && tSim > T_SET ? T_RISE : T_SET)
  const kind = target === T_RISE ? 'EARTHRISE' : 'EARTHSET'
  const remainVideo = vsec(target) - vsec(tSim)
  const sinceEvent = -remainVideo
  if (remainVideo > 0) {
    text(kind, W / 2, 196, { size: 22, color: C.dim, align: 'center', spacing: 6 })
    const urgent = remainVideo <= 5
    text(`T-${hms(remainVideo)}`, W / 2, 262, { size: 64, align: 'center', weight: 700, color: kind === 'EARTHSET' ? (urgent ? C.amber : C.text) : C.text, spacing: 2 })
  }
  // link / signal state
  if (!up && (kind === 'EARTHSET' ? sinceEvent >= 0 : remainVideo > 0)) {
    const blink = kind === 'EARTHSET' && Math.floor(sinceEvent * 2.2) % 2 === 1
    if (kind === 'EARTHSET') {
      if (!blink) text('SIGNAL LOST', W / 2, 262, { size: 72, align: 'center', weight: 800, color: C.red, spacing: 6 })
      text('EARTH BELOW THE TERRAIN HORIZON', W / 2, 306, { size: 18, align: 'center', color: C.dim, spacing: 2 })
    } else {
      text('NO SIGNAL · EARTH BELOW THE TERRAIN HORIZON', W / 2, 306, { size: 18, align: 'center', color: C.dim, spacing: 2 })
    }
  } else if (link && remainVideo <= 0) {
    const via = links.find((l) => l.id === 'malargue') ? 'MALARGÜE' : STN[links[0].id].split(' ')[0]
    text(`LINK ✓ ${via}`, W / 2, 262, { size: 64, align: 'center', weight: 800, color: C.green, spacing: 4 })
  }

  // left: telemetry
  const y0 = 420
  text('EARTH', 56, y0, { size: 16, color: C.blue, spacing: 3, weight: 700 })
  text(`EL   ${s.earthEl >= 0 ? '+' : '−'}${Math.abs(s.earthEl).toFixed(2)}°`, 56, y0 + 32, { size: 20 })
  text(`AZ   ${s.earthAz.toFixed(2)}°`, 56, y0 + 60, { size: 20 })
  text(`CLR  ${s.earthClear >= 0 ? '+' : '−'}${Math.abs(s.earthClear).toFixed(2)}°`, 56, y0 + 88, { size: 20, color: up ? C.text : C.red })
  text('SUN', 56, y0 + 140, { size: 16, color: C.amber, spacing: 3, weight: 700 })
  text(`EL   ${s.sunEl >= 0 ? '+' : '−'}${Math.abs(s.sunEl).toFixed(2)}°`, 56, y0 + 172, { size: 20 })
  text(s.sunClear > 0 ? 'ABOVE TERRAIN' : 'BELOW TERRAIN', 56, y0 + 200, { size: 16, color: C.dim })

  // right: ground stations (second horizon)
  text('GROUND STATIONS · MOON > 10°', W - 56, y0, { size: 16, color: C.dim, align: 'right', spacing: 2, weight: 700 })
  M.stations.forEach((st, k) => {
    const el = s.st[st.id], vis = el > M.station_mask_deg, ok = vis && up
    const y = y0 + 32 + k * 30
    text(`${STN[st.id] || st.id}  ${el >= 0 ? '+' : '−'}${pad2(Math.abs(el).toFixed(0))}°  ${ok ? 'LINK' : vis ? 'WAIT' : '  — '}`, W - 56, y,
      { size: 19, align: 'right', color: ok ? C.green : vis ? C.text : C.dim, weight: ok ? 700 : 500 })
  })
}

// Glitch: horizontal slice shifts + RGB split for ~0.4 s after Earthset
function glitch(strength, seed) {
  if (strength <= 0) return
  const r = rng(seed)
  const img = ctx.getImageData(0, 0, W, H)
  const src = new Uint8ClampedArray(img.data)
  const d = img.data
  const split = Math.round(10 * strength)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4, pr = (y * W + Math.min(W - 1, x + split)) * 4
    d[p] = src[pr]
  }
  ctx.putImageData(img, 0, 0)
  for (let k = 0; k < Math.round(14 * strength); k++) {
    const y = Math.floor(r() * H), h = 4 + Math.floor(r() * 40), dx = Math.round((r() - 0.5) * 160 * strength)
    ctx.drawImage(out, 0, y, W, h, dx, y, W, h)
  }
}

// ---------------- frame ----------------
function simTimeAt(vt) { return KNOTS ? pw(KNOTS, vt) : T_EVENT + (vt - PRE) * LAPSE }

function renderAt(tSim, vt) {
  const s = sample(tSim)
  const lit = earthLitFraction(s)
  placeBodies(s)
  shadeTerrain(s, lit)
  renderer.render(scene, camera)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(glCanvas, 0, 0)
  // subtle vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95)
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
  drawHud(s, tSim, vt)
  if (T_SET !== null) {
    const since = vsec(tSim) - vsec(T_SET)
    if (since >= 0 && since < 0.45) glitch(1 - since / 0.45, Math.floor(tSim))
  }
  return s
}

function renderFrame(i) { const vt = i / FPS; return renderAt(simTimeAt(vt), vt) }
window.renderFrame = renderFrame

// ---------------- modes ----------------
const status = document.getElementById('status')
const scrub = document.getElementById('scrub')
await new Promise((r) => THREE.DefaultLoadingManager.onLoad = r)
await document.fonts.ready

if (MODE === 'render') {
  const N = Math.round(DUR * FPS)
  for (let i = 0; i < N; i++) {
    renderFrame(i)
    const blob = await new Promise((r) => out.toBlob(r, 'image/png'))
    const res = await fetch(`/frame?shot=${SHOT_ID}&i=${i}`, { method: 'POST', body: blob })
    if (!res.ok) { status.textContent = `frame ${i}: HTTP ${res.status}`; throw new Error('frame upload failed') }
    status.textContent = `render ${SHOT_ID}: ${i + 1}/${N}`
  }
  await fetch(`/done?shot=${SHOT_ID}&n=${N}&fps=${FPS}`, { method: 'POST' })
  status.textContent = `render ${SHOT_ID}: done (${N} frames) — encoding in frame_server`
} else if (MODE === 'live') {
  const start = num('start', Date.now())
  const loop = () => {
    const vt = (Date.now() - start) / 1000
    const tSim = simTimeAt(vt)
    const s = renderAt(tSim, vt)
    status.textContent = `live ${SHOT_ID} · t ${vt.toFixed(1)} s · clearance ${s.earthClear.toFixed(3)}°`
    requestAnimationFrame(loop)
  }
  loop()
} else {
  let vt = 0, playing = true, last = performance.now()
  addEventListener('keydown', (e) => { if (e.code === 'Space') { playing = !playing; e.preventDefault() } })
  scrub.addEventListener('input', () => { vt = (scrub.value / 1000) * DUR; playing = false })
  const loop = (now) => {
    if (playing) { vt += (now - last) / 1000; if (vt > DUR) vt = 0 }
    last = now
    const s = renderAt(simTimeAt(vt), vt)
    scrub.value = String(Math.round((vt / DUR) * 1000))
    status.textContent = `${SHOT_ID} · video ${vt.toFixed(2)} s · ×${LAPSE.toFixed(0)} · Earth clearance ${s.earthClear.toFixed(3)}°`
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
