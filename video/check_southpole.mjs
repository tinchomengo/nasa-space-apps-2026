// Node check of the S3 labels: opacity per label over the 12 s clip (no WebGL needed).
//   node video/check_southpole.mjs
import fs from 'fs'
import * as THREE from './node_modules/three/build/three.module.js'
import { makeCore } from './src/sp_core.js'

const D = new URL('./public/data/', import.meta.url)
const meta = JSON.parse(fs.readFileSync(new URL('sp_meta.json', D)))
const buf = fs.readFileSync(new URL('sp_height.bin', D))
const hbuf = new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2)
const core = makeCore(THREE, meta, hbuf)
const cam = new THREE.PerspectiveCamera(42, 1920 / 1080, 0.1, 5000)
const DUR = 12
const names = core.anchors.map((a) => a.def.title.split(' ').slice(-1)[0].slice(0, 8).padEnd(8))
console.log('  t   ' + names.join(' '))
for (let t = 0; t <= DUR + 1e-9; t += 0.5) {
  const row = core.anchors.map((a) => {
    const al = core.alphaAt(a, cam, t, DUR)
    return (al === 0 ? '   .    ' : al.toFixed(2).padStart(6) + '  ')
  })
  console.log(t.toFixed(1).padStart(5) + ' ' + row.join(' '))
}
console.log('sides:', core.anchors.map((a) => `${a.def.title}=${a.side > 0 ? 'right' : 'left'}`).join(', '))
