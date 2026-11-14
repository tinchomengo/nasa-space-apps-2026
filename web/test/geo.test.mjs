// Browser geometry (src/lib/geo.ts) vs Skyfield. Run: npm run test:geo  (tsc compiles geo.ts; plain node runs this).
// Fixture: test/fixtures/geo_ref.json from pipeline/export_browser.py (full-precision Skyfield az/el).
import { readFileSync } from 'node:fs'
import { azElFrom, discFraction, enuBasis } from '../.test-build/lib/geo.js'

const TOL_DEG = 0.001
const root = new URL('..', import.meta.url).pathname
const refs = JSON.parse(readFileSync(`${root}test/fixtures/geo_ref.json`, 'utf8'))
const meta = JSON.parse(readFileSync(`${root}public/data/ephem_vectors.json`, 'utf8'))
const buf = readFileSync(`${root}public/data/ephem_vectors.bin`)
const data = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)

let worst = 0
let fails = 0
for (const r of refs) {
  const basis = enuBasis(r.lat, r.lon)
  let siteWorst = 0
  r.t.forEach((t, k) => {
    const i = Math.round((t - meta.t0) / meta.stepSec)
    for (const [body, o] of [['sun', 0], ['earth', 3]]) {
      const got = azElFrom([data[6 * i + o], data[6 * i + o + 1], data[6 * i + o + 2]], basis, r.elev_m / 1000)
      const refAz = r[`${body}Az`][k]
      const refEl = r[`${body}El`][k]
      const dAz = Math.abs(((got.az - refAz + 540) % 360) - 180)
      const dEl = Math.abs(got.el - refEl)
      // azimuth is degenerate near the zenith (equatorial sites): compare the on-sky azimuth error
      siteWorst = Math.max(siteWorst, dEl, dAz * Math.cos((refEl * Math.PI) / 180))
    }
  })
  worst = Math.max(worst, siteWorst)
  const ok = siteWorst < TOL_DEG
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(22)} max |Δ| = ${siteWorst.toExponential(2)}°`)
}
const near = (a, b) => Math.abs(a - b) < 1e-4
if (!near(discFraction(0, 0.27), 0.5) || !near(discFraction(0.5, 1), 1 - 0.1955) || !near(discFraction(-1, 0.27), 0)) {
  console.log('FAIL discFraction'); fails++
}
console.log(`worst ${worst.toExponential(2)}° (tolerance ${TOL_DEG}°)`)
if (fails) { console.error(`${fails} failure(s)`); process.exit(1) }

// End-to-end: rebuild curated sites in the browser code path (hourly) and compare long-run stats
// with the pipeline (10-min). Same horizon mask and site height; expect agreement within ~0.5 pts.
const { computePoint } = await import('../.test-build/lib/custom.js')
const vec = { t0: meta.t0, stepSec: meta.stepSec, n: meta.n, data }
let e2eFails = 0
for (const id of ['connecting-ridge', 'malapert', 'mons-mouton', 'apollo-11']) {
  const s = JSON.parse(readFileSync(`${root}public/data/site_${id}.json`, 'utf8'))
  const c = computePoint({ id, name: id, lat: s.meta.lat, lon: s.meta.lon, siteHeightM: s.meta.site_height_m,
    horizon: s.horizon, horizonSource: s.meta.horizon_source }, vec)
  const dSun = c.stats.sunlit_pct - s.stats.sunlit_pct
  const dEarth = c.stats.earth_visible_pct - s.stats.earth_visible_pct
  const ok = Math.abs(dSun) < 0.5 && Math.abs(dEarth) < 0.5
  if (!ok) e2eFails++
  console.log(`${ok ? 'PASS' : 'FAIL'} e2e ${id.padEnd(18)} sunlit ${c.stats.sunlit_pct.toFixed(2)} vs ${s.stats.sunlit_pct.toFixed(2)} | earth ${c.stats.earth_visible_pct.toFixed(2)} vs ${s.stats.earth_visible_pct.toFixed(2)} | events ${c.events.length} vs ${s.events.length}`)
}
if (e2eFails) { console.error(`${e2eFails} e2e failure(s)`); process.exit(1) }

// Neighbourhood grid centre (index 220 of 21×21, 1° mask) must reproduce the curated site (0.5° mask).
let nbFails = 0
for (const id of ['connecting-ridge', 'shackleton-rim', 'peak-near-shackleton', 'de-gerlache-rim', 'malapert', 'mons-mouton', 'nobile-rim-1']) {
  const s = JSON.parse(readFileSync(`${root}public/data/site_${id}.json`, 'utf8'))
  const m = JSON.parse(readFileSync(`${root}public/data/nb_${id}.json`, 'utf8'))
  const b = readFileSync(`${root}public/data/nb_${id}.bin`)
  const masks = new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2)
  const k = (m.n * m.n - 1) / 2
  const horizon = Array.from({ length: 360 }, (_, a) => masks[k * 360 + a] / 100)
  const dPos = Math.hypot(m.lat[k] - s.meta.lat, (m.lon[k] - s.meta.lon) * Math.cos((s.meta.lat * Math.PI) / 180)) * 30.32 * 1000
  const c = computePoint({ id, name: id, lat: m.lat[k], lon: m.lon[k], siteHeightM: m.height_m[k], horizon, horizonSource: s.meta.horizon_source }, vec)
  const dSun = c.stats.sunlit_pct - s.stats.sunlit_pct
  const dEarth = c.stats.earth_visible_pct - s.stats.earth_visible_pct
  const ok = dPos < 1 && Math.abs(dSun) < 1.5 && Math.abs(dEarth) < 1.5
  if (!ok) nbFails++
  console.log(`${ok ? 'PASS' : 'FAIL'} grid-centre ${id.padEnd(20)} offset ${dPos.toFixed(2)} m | sunlit ${dSun >= 0 ? '+' : ''}${dSun.toFixed(2)} | earth ${dEarth >= 0 ? '+' : ''}${dEarth.toFixed(2)} pts (1° vs 0.5° mask)`)
}
if (nbFails) { console.error(`${nbFails} grid-centre failure(s)`); process.exit(1) }
