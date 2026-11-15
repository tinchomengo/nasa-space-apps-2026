// S3 core, no DOM: terrain heights, camera path, label definitions and label visibility.
// Shared by the page (southpole.js) and a Node check (video/check_southpole.mjs).
// Scene units km: x = u (toward the Sun's horizontal direction), y = up, z = -v.

export const LABEL_DEFS = {
  Nobile: { title: 'CRÁTER NOBILE', t0: 0.3 },
  'Mons Mouton (IM-2)': { title: 'MONTE MOUTON', sub: 'aquí terminó la misión Athena (IM-2)', t0: 0.9 },
  Malapert: { title: 'MACIZO MALAPERT', t0: 3.3 },
  'de Gerlache': { title: 'CRÁTER DE GERLACHE', t0: 6.0 },
  Shackleton: { title: 'CRÁTER SHACKLETON', sub: 'sombra permanente', t0: 7.0, side: -1 }, // text over the dark floor
  'Connecting Ridge': { title: 'CRESTA DE CONEXIÓN', sub: 'zona candidata de alunizaje', t0: 8.6, amber: true },
}
export const HEADER = 'POLO SUR DE LA LUNA · RELIEVE LOLA (NASA)'
export const STYLE = { title: 21, titleHl: 24, sub: 16, lead: 70, gap: 20, margin: 40 }
const CHAR = 0.6 // SF Mono / Menlo advance in em
export const textWidth = (s, size, spacing = 2) => s.length * (CHAR * size + spacing)

export function makeCore(THREE, meta, hbuf, { exag = 1.3, W = 1920, H = 1080, keys = null } = {}) {
  const N = meta.n_mesh, HALF = meta.half_km, R = meta.moon_radius_m
  const curv = (u, v) => ((u * u + v * v) * 1e6) / (2 * R) / 1000
  const heightAt = (h_m, u, v) => (h_m * exag) / 1000 - curv(u, v)
  const hm = (i, j) => meta.height_lo_m + ((Math.max(hbuf[i * N + j], 1) - 1) / 65534) * (meta.height_hi_m - meta.height_lo_m) // 0 = no data

  /** Terrain surface y (km) at (u, v), bilinear on the mesh grid (cell centres). */
  function terrainY(u, v) {
    const fj = ((u + HALF) / (2 * HALF)) * N - 0.5, fi = ((v + HALF) / (2 * HALF)) * N - 0.5
    if (fj < 0 || fi < 0 || fj > N - 1 || fi > N - 1) return -Infinity
    const j = Math.min(N - 2, Math.floor(fj)), i = Math.min(N - 2, Math.floor(fi)), a = fj - j, b = fi - i
    const h = hm(i, j) * (1 - a) * (1 - b) + hm(i, j + 1) * a * (1 - b) + hm(i + 1, j) * (1 - a) * b + hm(i + 1, j + 1) * a * b
    return heightAt(h, u, v)
  }

  const lab = Object.fromEntries(meta.labels.map((l) => [l.name, l]))
  const cr = lab['Connecting Ridge']
  const toV = ([u, v, alt]) => new THREE.Vector3(u, alt - curv(u, v), -v)
  // camera keys (u, v, altitude km above datum) and look-at keys
  const camKeys = [[150, 250, 46], [112, 190, 37], [62, 112, 30], [26, 46, 27], [11, 19, 13]]
  const tgtKeys = [[60, 112, 0], [18, 104, 0], [-10, 50, 0], [-2, -4, 0], [cr.u_km, cr.v_km, cr.h_m / 1000]]
  const K = keys ? keys(cr) : { cam: camKeys, tgt: tgtKeys }
  const camCurve = new THREE.CatmullRomCurve3(K.cam.map(toV), false, 'centripetal')
  const tgtCurve = new THREE.CatmullRomCurve3(K.tgt.map(toV), false, 'centripetal')
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2) * 0.35 + x * 0.65

  const at = (t, dur) => { const x = ease(Math.max(0, Math.min(1, t / dur))); return [camCurve.getPoint(x), tgtCurve.getPoint(x)] }
  const lead = {} // t < 0: the same flight before the path starts, at its starting velocity (C1-continuous)
  function pose(camera, t, dur) {
    let p, q
    if (t >= 0) [p, q] = at(t, dur)
    else {
      if (lead.dur !== dur) {
        const [p0, q0] = at(0, dur), [p1, q1] = at(0.02, dur)
        Object.assign(lead, { dur, p0, q0, vp: p1.clone().sub(p0).divideScalar(0.02), vq: q1.clone().sub(q0).divideScalar(0.02) })
      }
      p = lead.p0.clone().addScaledVector(lead.vp, t)
      q = lead.q0.clone().addScaledVector(lead.vq, t)
    }
    camera.position.copy(p)
    camera.lookAt(q)
    camera.updateMatrixWorld()
  }

  const anchors = meta.labels.filter((l) => LABEL_DEFS[l.name]).map((l) => ({
    ...l, def: LABEL_DEFS[l.name],
    p: new THREE.Vector3(l.u_km, heightAt(l.h_m, l.u_km, l.v_km) + 0.15, -l.v_km), // +150 m above the surface
  }))

  /** True if terrain blocks the line of sight camera -> anchor. */
  function occluded(cam, p) {
    const steps = 240
    for (let k = 1; k < steps; k++) {
      const s = (k / steps) * 0.985
      const x = cam.x + (p.x - cam.x) * s, y = cam.y + (p.y - cam.y) * s, z = cam.z + (p.z - cam.z) * s
      if (terrainY(x, -z) > y + 0.03) return true
    }
    return false
  }

  /** Screen geometry of a label at the camera's current pose (side: +1 right, -1 left). */
  function layout(a, camera, side) {
    const s = a.p.clone().project(camera)
    const x = (s.x * 0.5 + 0.5) * W, y = (-s.y * 0.5 + 0.5) * H
    const d = a.def, tsize = d.amber ? STYLE.titleHl : STYLE.title
    const w = Math.max(textWidth(d.title, tsize), d.sub ? textWidth(d.sub, STYLE.sub, 1) : 0)
    const ty = y - STYLE.lead + 2 // title baseline
    const top = ty - tsize, bottom = d.sub ? ty + 6 + STYLE.sub : y + 6
    const x0 = side > 0 ? x - 6 : x - STYLE.gap - w, x1 = side > 0 ? x + STYLE.gap + w : x + 6
    const m = STYLE.margin
    const inFrame = s.z < 1 && x0 >= m && x1 <= W - m && top >= m && bottom <= H - m
    return { x, y, ty, w, inFrame }
  }

  /** Side fixed per label for the whole clip: def.side if given, else chosen once at t0 (right if it fits). */
  function sideOf(a, camera, dur) {
    if (a.side) return a.side
    if (a.def.side) return (a.side = a.def.side)
    pose(camera, a.def.t0, dur)
    a.side = layout(a, camera, 1).inFrame ? 1 : -1
    return a.side
  }

  /** Raw visibility at time t: anchor in front, label box inside the frame, line of sight clear. */
  function visibleAt(a, camera, t, dur) {
    pose(camera, t, dur)
    const L = layout(a, camera, sideOf(a, camera, dur))
    return L.inFrame && !occluded(camera.position, a.p)
  }

  /** Smoothed label opacity at time t (fades in at t0, fades out/in around occlusion or frame exits). */
  function alphaAt(a, camera, t, dur) {
    if (t < a.def.t0) return 0
    const ks = [-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24]
    let v = 0
    for (const k of ks) v += visibleAt(a, camera, Math.max(a.def.t0, t + k), dur) ? 1 : 0
    return Math.min(1, (t - a.def.t0) / 0.5) * (v / ks.length)
  }

  return { heightAt, terrainY, pose, anchors, layout, sideOf, visibleAt, alphaAt, occluded }
}
